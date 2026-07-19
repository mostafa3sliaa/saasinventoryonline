<?php
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
?>