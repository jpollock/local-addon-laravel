# User Guide

## Overview

Local Laravel brings first-class Laravel development to Local (by Flywheel). Create, develop, and manage Laravel applications with the same ease as WordPress sites, using Local's bundled PHP, MySQL, and Nginx infrastructure.

## Installation

### Method 1: Pre-built Release (Recommended)

The easiest way to install the addon.

1. Go to the [Releases page](https://github.com/jpollock/local-addon-laravel/releases)
2. Download the `.tgz` file from the latest release (e.g., `local-addon-laravel-0.0.1.tgz`)
3. Open **Local**
4. Go to **Add-ons** (in the left sidebar)
5. Click **Install from disk** (top right)
6. Select the `.tgz` file you downloaded
7. Toggle the addon **ON** to enable
8. Click **Relaunch** when prompted

### Method 2: Build from Source

For developers or contributors:

```bash
git clone https://github.com/jpollock/local-addon-laravel.git
cd local-addon-laravel
npm install
npm run build
npm run install-addon
# Restart Local, then enable the addon
```

## Uninstallation

### If installed from disk (Method 1)

1. Open **Local**
2. Go to **Add-ons** (in the left sidebar)
3. Find **Local Laravel**
4. Toggle it **OFF**
5. Click the **trash icon** or **Remove** button
6. Restart Local

### If installed via npm script (Method 2)

```bash
cd local-addon-laravel
npm run uninstall-addon
```

Then restart Local.

## Creating a Laravel Site

1. Click **+ Create a new site** in Local
2. Select **Laravel Project** from the site type options
3. Enter your site name and domain
4. Choose your PHP version (8.2+ required) and Laravel configuration
5. Click **Create Site**

Local Laravel will automatically:
- Create a new Laravel project using Composer
- Configure your `.env` file with Local's database credentials
- Run initial migrations
- Set up Nginx with Laravel-optimized configuration

## Using the Laravel Panel

Once your Laravel site is running, access the Laravel-specific features:

1. Open your Laravel site in Local
2. Go to the **Laravel** tab in the site info panel
3. Use the quick command buttons or enter custom Artisan commands
4. View output directly in Local

### Quick Commands

| Command | Description |
|---------|-------------|
| `migrate` | Run database migrations |
| `migrate:fresh --seed` | Fresh migration with seeders |
| `cache:clear` | Clear application cache |
| `route:list` | List all registered routes |
| `make:model` | Create a new Eloquent model |
| `make:controller` | Create a new controller |

### Custom Artisan Commands

Enter any valid Artisan command in the text field and click **Run**. Output appears in the panel below.

## Configuration

### Laravel Versions

Local Laravel supports:
- **Laravel 11.x** (default) - requires PHP 8.2+
- **Laravel 10.x** - requires PHP 8.1+

### Starter Kits

When creating a new site, you can optionally include:

| Kit | Description |
|-----|-------------|
| **None** | Vanilla Laravel installation |
| **Laravel Breeze** | Simple authentication scaffolding with Blade/Tailwind |

More starter kits (Jetstream, Filament) coming in future releases.

### Site Directory Structure

Your Laravel app lives in the standard Local site structure:

```
~/Local Sites/your-site/
├── app/
│   ├── public/          # Laravel's public directory (web root)
│   ├── app/             # Application code
│   ├── config/          # Configuration files
│   ├── database/        # Migrations, seeders, factories
│   ├── resources/       # Views, assets
│   ├── routes/          # Route definitions
│   ├── storage/         # Logs, cache, sessions
│   ├── tests/           # Test files
│   ├── .env             # Environment configuration
│   ├── artisan          # Artisan CLI
│   └── composer.json    # Dependencies
├── conf/                # Local's service configs
└── logs/                # Service logs
```

## FAQ

### Q: What PHP version do I need?

A: Laravel 11 requires PHP 8.2 or higher. Laravel 10 requires PHP 8.1+. Select the appropriate PHP version in Local's site configuration.

### Q: Can I use existing Laravel projects?

A: Currently, Local Laravel is designed for creating new Laravel projects. Support for importing existing projects is planned for a future release.

### Q: Where are my Laravel logs?

A: Laravel's application logs are in `~/Local Sites/your-site/app/storage/logs/laravel.log`.

### Q: How do I run npm commands for my frontend?

A: Use Local's "Open Site Shell" feature to get a terminal in your site directory, then run `npm install`, `npm run dev`, etc.

## Support

- **Report bugs**: [GitHub Issues](https://github.com/jpollock/local-addon-laravel/issues)
- **Feature requests**: [GitHub Discussions](https://github.com/jpollock/local-addon-laravel/discussions)
- **Questions**: [GitHub Discussions](https://github.com/jpollock/local-addon-laravel/discussions)
