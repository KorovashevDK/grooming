# export-simple.ps1 - Простая версия
$output = "project-code.txt"
$exclude = @("*node_modules*", "*.git*", "*dist*", "*build*")

# Очищаем файл
"" | Out-File $output -Encoding UTF8

# Находим все JS файлы (кроме node_modules)
$files = Get-ChildItem -Recurse -Include "*.js", "*.jsx", "*.ts", "*.tsx", "*.json", "*.html" |
         Where-Object { $_.FullName -notlike "*node_modules*" } |
         Where-Object { $_.FullName -notlike "*\.git*" } |
         Sort-Object FullName

foreach ($file in $files) {
    $relativePath = $file.FullName.Replace($pwd.Path + "\", "")
    
    "`n" + ("=" * 80) | Out-File $output -Append -Encoding UTF8
    "FILE: $relativePath" | Out-File $output -Append -Encoding UTF8
    ("=" * 80) | Out-File $output -Append -Encoding UTF8
    
    Get-Content $file.FullName -Raw -Encoding UTF8 | Out-File $output -Append -Encoding UTF8
}

Write-Host "✅ Done! Created $output with $($files.Count) files" -ForegroundColor Green