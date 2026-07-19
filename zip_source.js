const fs = require('fs');
const archiver = require('archiver');

const output = fs.createWriteStream('inventorysaas_full.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log('Zip created successfully. Total bytes: ' + archive.pointer());
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

// Add everything except heavy auto-generated folders
archive.glob('**/*', {
  ignore: ['node_modules/**', '.next/**', 'inventorysaas_full.zip', 'deploy.zip', 'zip_source.js']
});

archive.finalize();
