<?php
$secret_token = "inventory_secure_deploy_2026";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_POST['token']) || $_POST['token'] !== $secret_token) {
        http_response_code(403);
        die("Unauthorized access.");
    }

    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = './';
        $uploadFile = $uploadDir . basename($_FILES['file']['name']);

        if (move_uploaded_file($_FILES['file']['tmp_name'], $uploadFile)) {
            echo "File successfully uploaded.\n";
            
            // Extract the zip
            $zip = new ZipArchive;
            if ($zip->open($uploadFile) === TRUE) {
                $zip->extractTo('./');
                $zip->close();
                echo "Extraction successful.\n";
                
                // Cleanup zip
                unlink($uploadFile);
                
                // Set permissions for Next.js cache
                exec('chmod -R 755 .next');
                
                // Restart Node.js app
                if (!is_dir('tmp')) {
                    mkdir('tmp');
                }
                touch('tmp/restart.txt');
                echo "App restarted successfully.\n";
            } else {
                http_response_code(500);
                echo "Extraction failed.\n";
            }
        } else {
            http_response_code(500);
            echo "Upload failed.\n";
        }
    } else {
        http_response_code(400);
        echo "No file uploaded or upload error.\n";
    }
} else {
    http_response_code(405);
    echo "Method not allowed.\n";
}
?>
