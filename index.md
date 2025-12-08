---
layout: default
title: Home
---

# Local Laravel

![Status](https://img.shields.io/badge/status-beta-orange) ![License](https://img.shields.io/badge/license-MIT-blue) ![Local](https://img.shields.io/badge/Local-v9.0%2B-green)

First-class Laravel development environment for [Local](https://localwp.com). Create, develop, and manage Laravel applications with the same ease as WordPress sites.

## Features

- **One-Click Laravel Sites** - Create new Laravel projects directly from Local's site creation flow
- **Automatic Configuration** - Database credentials, APP_URL, and environment configured automatically
- **Artisan Integration** - Run artisan commands directly from Local's UI
- **Starter Kit Support** - Quick setup with Laravel Breeze (more kits coming soon)
- **Leverages Local's Infrastructure** - Uses Local's bundled PHP, MySQL, and Nginx

## Quick Start

### Installation

**Method 1: Pre-built Release (Recommended)**

1. Go to the [Releases page](https://github.com/jpollock/local-addon-laravel/releases)
2. Download the `.tgz` file from the latest release
3. Open **Local** > **Add-ons** > **Install from disk**
4. Select the `.tgz` file and toggle **ON**
5. Click **Relaunch**

**Method 2: Build from Source**

```bash
git clone https://github.com/jpollock/local-addon-laravel.git
cd local-addon-laravel
npm install
npm run build
npm run install-addon

# Restart Local, then enable the addon:
# Local > Add-ons > Installed > Local Laravel > Enable
```

### Creating Your First Laravel Site

1. Click **+ Create a new site** in Local
2. Select **Laravel Project**
3. Enter your site name and configure options
4. Click **Create Site**

That's it! Local Laravel handles all the setup automatically.

## Documentation

- [User Guide](docs/USER_GUIDE.md) - Complete guide for end users
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Technical documentation for contributors
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

## Requirements

- Local v9.0.0 or higher
- PHP 8.2+ (for Laravel 11) or PHP 8.1+ (for Laravel 10)

## Supported Laravel Versions

| Laravel Version | PHP Requirement | Status |
|-----------------|-----------------|--------|
| Laravel 11.x | PHP 8.2+ | Default |
| Laravel 10.x | PHP 8.1+ | Supported |

## Starter Kits

| Kit | Description |
|-----|-------------|
| None | Vanilla Laravel installation |
| Laravel Breeze | Simple authentication with Blade/Tailwind |

More starter kits (Jetstream, Filament) coming in future releases.

## Feedback & Issues

- **Report bugs or request features**: [GitHub Issues](https://github.com/jpollock/local-addon-laravel/issues)
- **Questions & discussions**: [GitHub Discussions](https://github.com/jpollock/local-addon-laravel/discussions)
- **View source code**: [GitHub Repository](https://github.com/jpollock/local-addon-laravel)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- Built for [Local](https://localwp.com) by Flywheel
- Inspired by the Laravel community's commitment to developer experience
- Uses [Composer](https://getcomposer.org) for package management
