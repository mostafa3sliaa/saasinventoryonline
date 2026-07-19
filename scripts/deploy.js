const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });

// Configuration
const config = {
  host: process.env.SSH_HOST, // Reusing SSH_HOST for FTP host
  user: process.env.FTP_USER || 'mostlswx',
  password: process.env.FTP_PASSWORD || process.env.SSH_PASSWORD,
  port: 21,
  remoteDir: 'inventory.mostafa3slia.com', // CPanel FTP starts at /home/user
  zipName: 'deploy.zip',
  localZipPath: path.join(__dirname, '..', 'deploy.zip'),
  unzipScriptUrl: `https://${process.env.SSH_HOST}/unzip.php`
};

const unzipPhpCode = `<?php
$zip = new ZipArchive;
if ($zip->open('deploy.zip') === TRUE) {
    $zip->extractTo('./');
    $zip->close();
    unlink('deploy.zip');
    exec('chmod -R 755 .next');
    if (!is_dir('tmp')) mkdir('tmp');
    touch('tmp/restart.txt');
    echo "SUCCESS";
} else {
    echo "FAILED";
}
unlink(__FILE__);
?>`;

async function createZip() {
  return new Promise((resolve, reject) => {
    console.log('📦 Creating zip archive using PowerShell...');
    try {
      execSync('powershell -Command "Remove-Item -Recurse -Force .next/cache -ErrorAction Ignore; Remove-Item -Recurse -Force .next/dev -ErrorAction Ignore; Get-ChildItem -Path . -Exclude node_modules, .git, scratch, supabase, deploy.zip, .env.local, unzip.php | Compress-Archive -DestinationPath deploy.zip -Force"', { stdio: 'inherit' });
      const stats = fs.statSync(config.localZipPath);
      console.log(`✅ Zip created successfully: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

async function deploy() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    if (!config.host || !config.user || !config.password) {
      console.error('❌ Missing credentials in .env.local!');
      process.exit(1);
    }

    console.log('🔨 Step 1: Building Next.js app...');
    execSync('npm run build', { stdio: 'inherit' });

    console.log('\n🤐 Step 2: Zipping files...');
    await createZip();

    console.log('\n📝 Step 3: Creating extraction script...');
    fs.writeFileSync('unzip.php', unzipPhpCode);

    console.log('\n🌐 Step 4: Connecting to server via FTP...');
    await client.access({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port,
      secure: false
    });
    console.log('✅ Connected!');

    console.log('\n📂 Navigating to remote directory...');
    await client.cd(config.remoteDir);

    console.log('\n📤 Step 5: Uploading files...');
    await client.uploadFrom('deploy.zip', 'deploy.zip');
    console.log('✅ deploy.zip uploaded!');
    await client.uploadFrom('unzip.php', 'unzip.php');
    console.log('✅ unzip.php uploaded!');

    console.log('\n⚙️ Step 6: Triggering extraction & server restart...');
    // We use dynamic import for node-fetch if using Node < 18, but Node 18+ has native fetch.
    const response = await fetch(config.unzipScriptUrl);
    const text = await response.text();
    
    if (text.trim() === 'SUCCESS') {
      console.log('✅ Extraction and server restart complete!');
    } else {
      console.warn('⚠️ Server returned:', text);
    }

    // Cleanup local files
    if (fs.existsSync(config.localZipPath)) fs.unlinkSync(config.localZipPath);
    if (fs.existsSync('unzip.php')) fs.unlinkSync('unzip.php');
    console.log('🧹 Cleaned up local files');

    console.log('\n🎉 DEPLOYMENT SUCCESSFUL! The site has been updated.');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
