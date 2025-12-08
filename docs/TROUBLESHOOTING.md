# Troubleshooting

## Common Issues

### Addon doesn't appear in Local

**Symptoms**: After installation, the addon doesn't show in Local's Add-ons list.

**Solutions**:
1. Restart Local completely (quit and reopen)
2. Check that the addon is in the correct directory:
   - macOS: `~/Library/Application Support/Local/addons/`
   - Linux: `~/.config/Local/addons/`
   - Windows: `%APPDATA%\Local\addons\`
3. Verify the addon was built: check for `lib/` directory with `main.js` and `renderer.js`
4. Check Local's logs for loading errors

### Addon fails to load

**Symptoms**: Addon appears but shows an error or doesn't function.

**Solutions**:
1. Check Local's logs for errors:
   - macOS: `~/Library/Logs/Local/local-lightning.log`
   - Linux: `~/.config/Local/logs/local-lightning.log`
   - Windows: `%APPDATA%\Local\logs\local-lightning.log`
2. Rebuild the addon: `npm run build`
3. Reinstall: `npm run uninstall-addon && npm run install-addon`

### Site won't start

**Symptoms**: Laravel site fails to start or shows errors.

**Solutions**:
1. Check that PHP 8.2+ is selected for the site in Local's settings
2. Verify MySQL service is running (check Local's site status)
3. Check Laravel logs: `~/Local Sites/your-site/app/storage/logs/laravel.log`
4. Verify `.env` has correct database credentials

### Database connection errors

**Symptoms**: Laravel shows database connection errors.

**Solutions**:
1. Verify `.env` contains correct `DB_*` values:
   ```
   DB_CONNECTION=mysql
   DB_HOST=localhost
   DB_DATABASE=local
   DB_USERNAME=root
   DB_PASSWORD=root
   ```
2. Run `php artisan config:clear` via the Laravel panel
3. Check that MySQL socket path is correct in `.env`
4. Wait for MySQL to fully start before running commands

### Composer errors during site creation

**Symptoms**: Site creation fails with Composer errors.

**Solutions**:
1. Check PHP memory limit in Local's PHP settings (increase if needed)
2. Verify internet connectivity for downloading packages
3. Try creating the site again - transient network issues can cause failures
4. Check available disk space

### Artisan commands fail

**Symptoms**: Running Artisan commands from the panel fails or shows errors.

**Solutions**:
1. Ensure the site is running (started) in Local
2. Check that you're running commands on a Laravel site, not a WordPress site
3. View the full error output in the panel
4. Try running the command via SSH: Local > Site > Open Site Shell, then `php artisan {command}`

### "Laravel Project" option doesn't appear

**Symptoms**: When creating a new site, the Laravel Project option isn't shown.

**Solutions**:
1. Verify the addon is enabled in Local's Add-ons settings
2. Restart Local completely
3. Check that the addon loaded without errors in Local's logs

### Starter kit installation fails

**Symptoms**: Breeze or other starter kit fails to install.

**Solutions**:
1. Ensure Node.js is available (check with `node --version` in site shell)
2. Verify npm packages can be downloaded (network connectivity)
3. Check available disk space
4. Try installing the starter kit manually via SSH

### Nginx configuration errors

**Symptoms**: Site shows 502 Bad Gateway or Nginx errors.

**Solutions**:
1. Restart the site in Local
2. Check Nginx error logs: `~/Local Sites/your-site/logs/nginx/error.log`
3. Verify the Laravel `public/` directory exists and contains `index.php`
4. Ensure file permissions allow Nginx to read the public directory

### PHP-FPM errors

**Symptoms**: Site shows blank page or PHP errors.

**Solutions**:
1. Check PHP error logs: `~/Local Sites/your-site/logs/php/error.log`
2. Verify PHP version meets Laravel requirements (8.2+ for Laravel 11)
3. Ensure required PHP extensions are enabled in Local
4. Check Laravel's `storage/` directory has write permissions

## Log Locations

### Local Logs
- macOS: `~/Library/Logs/Local/local-lightning.log`
- Linux: `~/.config/Local/logs/local-lightning.log`
- Windows: `%APPDATA%\Local\logs\local-lightning.log`

### Site Logs
```
~/Local Sites/{site-name}/logs/
├── php/error.log
├── nginx/error.log
└── mysql/error.log
```

### Laravel Logs
```
~/Local Sites/{site-name}/app/storage/logs/laravel.log
```

## Getting Help

If your issue isn't listed here:

1. Search [existing issues](https://github.com/jpollock/local-addon-laravel/issues)
2. Open a [new issue](https://github.com/jpollock/local-addon-laravel/issues/new) with:
   - Local version
   - OS and version
   - PHP version configured in Local
   - Steps to reproduce
   - Error messages/logs
   - Screenshots if applicable
