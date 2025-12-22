<a name="3.0.0"></a>
# 3.0.0 (2025-12-22)

### Features
* **Modernization**: Full compatibility with Thunderbird 115+ (Supernova, Nebula, and beyond).
* **Internationalization**: Implementation of comprehensive multi-language support (English and French).
* **Security**: Migrated password storage to the native Thunderbird Password Manager.
* **Streamlined API**: Optimized for LinShare API v5, removing legacy and unused code.
* **UI Enhancements**: Modernized options page with better feedback and localized UI.

### Internal Changes
* Migrated from JSM to ES Modules (`.sys.mjs`).
* Refactored Experiment API for better stability and modern Thunderbird requirements.
* Cleaned up legacy v1, v2, and v4 API routes.

---

# [1.8.0](https://github.com/linagora/linshare-plugin-thunderbird/compare/1.7.1...1.8.0) (2018-10-31) [Download link](http://download.linshare.app/components/linshare-plugin-thunderbird/1.8.0/)

### Bug Fixes

* Support of ThunderBird 60

<a name="1.7.1"></a>
# [1.7.1](https://github.com/linagora/linshare-plugin-thunderbird/compare/1.7...v1.7.1) (2016-11-28) [Download link](http://download.linshare.app/components/linshare-plugin-thunderbird/1.7.1/)

### Bug Fixes

* Workaround for unsupported Expect http header.
    Tomcat returns a http 401 error code without waiting the end of the
    post request. The thunderbird xhr object does not support an early
    response and crash. It does not support Expect header too.


<a name="1.7"></a>
# [1.7](https://github.com/linagora/linshare-plugin-thunderbird/compare/1.6...1.7) (2013-05-21) [Download link](http://download.linshare.app/components/linshare-plugin-thunderbird/1.7/)

### Bug Fixes

* Adding cleaning function for linshare url.
* Fixing Thunderbird 2.0 support with API v2.
* Removing last slash at the end of the linshare configuration url.


<a name="1.6"></a>
# [1.6](https://github.com/linagora/linshare-plugin-thunderbird/compare/1.5...1.6) (2012-12-21) [Download link](http://download.linshare.app/components/linshare-plugin-thunderbird/1.6/)

### Features

* The plugin is now compatible with LinShare 0.x and 1.0.0 versions.


<a name="1.5"></a>
# [1.5](https://github.com/linagora/linshare-plugin-thunderbird/compare/1.4...1.5) (2012-11-26) [Download link](http://download.linshare.app/components/linshare-plugin-thunderbird/1.5/)

### Features

* fix ctrl + enter hotkey


<a name="1.4"></a>
# [1.4](https://github.com/linagora/linshare-plugin-thunderbird/compare/1.3...1.4) (2012-10-04) [Download link](http://download.linshare.app/components/linshare-plugin-thunderbird/1.4/)

### Bug Fixes

* Support of ThunderBird 17


<a name="1.1"></a>
# 1.1 (2009-12-18)

### Bug Fixes

* Add thunderbird 3.0 compatibility
* Fix Mac OS integration
* Display message before signature
* Fix some cases where custom message was not added
* Ask for configuration if the add-on is not already configuration
* Shorten button's label
* Move built files to a proper place
* Default button position is now just after "Send", not before
* Change icon in add-on menu

<a name="1.0"></a>
# 1.1 (2009-12-14)

### Features

* First release
