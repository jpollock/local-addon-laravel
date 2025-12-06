# Local Laravel

First-class Laravel development environment for [Local](https://localwp.com). Create, develop, and manage Laravel applications with the same ease as WordPress sites.

## Features

- **One-Click Laravel Sites** - Create new Laravel projects directly from Local's site creation flow
- **Automatic Configuration** - Database credentials, APP_URL, and environment configured automatically
- **Artisan Integration** - Run artisan commands directly from Local's UI
- **Starter Kit Support** - Quick setup with Laravel Breeze (more kits coming soon)
- **Leverages Local's Infrastructure** - Uses Local's bundled PHP, MySQL, and Nginx

## Requirements

- Local >= 9.0.0
- PHP 8.2+ (configured in Local)

## Installation

### From Local Add-on Browser (Coming Soon)

1. Open Local
2. Go to **Add-ons** in the sidebar
3. Search for "Local Laravel"
4. Click **Install**

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/flavius-labs/local-laravel/releases)
2. Extract to `~/.config/Local/addons/local-addon-laravel`
3. Restart Local

### Development Installation

```bash
git clone https://github.com/flavius-labs/local-laravel.git
cd local-laravel
npm install
npm run build
npm run install-addon
# Restart Local
```

## Usage

### Creating a Laravel Site

1. Click **+ Create a new site** in Local
2. Select **Laravel Project** from the options
3. Enter your site name and domain
4. Choose your PHP version and Laravel configuration
5. Click **Create Site**

Local Laravel will:
- Create a new Laravel project using Composer
- Configure your `.env` file with Local's database credentials
- Run initial migrations
- Set up Nginx with Laravel-optimized configuration

### Running Artisan Commands

1. Open your Laravel site in Local
2. Go to the **Laravel** tab in the site info panel
3. Use the quick command buttons or enter custom commands
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

## Configuration

### Laravel Versions

Local Laravel supports:
- Laravel 11.x (default, requires PHP 8.2+)
- Laravel 10.x (requires PHP 8.1+)

### Starter Kits

When creating a new site, you can optionally include:

- **None** - Vanilla Laravel installation
- **Laravel Breeze** - Simple authentication scaffolding with Blade/Tailwind

More starter kits (Jetstream, Filament) coming in future releases.

## How It Works

Local Laravel creates sites by:

1. **Provisioning Infrastructure** - Local creates the PHP-FPM, MySQL, and Nginx services
2. **Installing Laravel** - Runs `composer create-project laravel/laravel` in the site directory
3. **Configuring Environment** - Writes `.env` with database credentials and APP_URL
4. **Initial Setup** - Generates application key and runs migrations
5. **Custom Nginx Config** - Uses Laravel-optimized server configuration

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

## Troubleshooting

### Site won't start

1. Check that PHP 8.2+ is selected for the site
2. Verify MySQL service is running
3. Check `~/Local Sites/your-site/app/storage/logs/laravel.log` for errors

### Database connection errors

The addon automatically configures database credentials. If you're having issues:

1. Verify `.env` contains correct `DB_*` values
2. Run `php artisan config:clear` via the Artisan panel
3. Check that MySQL socket path is correct

### Composer errors

Local Laravel bundles Composer, but if you encounter issues:

1. Check PHP memory limit in Local's PHP settings
2. Try running `composer install` manually via SSH

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/flavius-labs/local-laravel.git
cd local-laravel
npm install
npm run watch  # Rebuild on changes
```

### Running Tests

```bash
npm test
npm run test:coverage
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- Built for [Local](https://localwp.com) by Flywheel
- Inspired by the Laravel community's commitment to developer experience
- Uses [Composer](https://getcomposer.org) for package management

## Support

- [GitHub Issues](https://github.com/flavius-labs/local-laravel/issues) - Bug reports and feature requests
- [Discussions](https://github.com/flavius-labs/local-laravel/discussions) - Questions and community help
