// Modernized for Thunderbird 140+ - using Services injection
let Services = null;

export function setServices(services) {
    Services = services;
}

export const Preferences = {
    get(name, defaultValue) {
        if (!Services) return defaultValue;
        try {
            switch (Services.prefs.getPrefType(name)) {
                case Services.prefs.PREF_STRING:
                    return Services.prefs.getStringPref(name);
                case Services.prefs.PREF_INT:
                    return Services.prefs.getIntPref(name);
                case Services.prefs.PREF_BOOL:
                    return Services.prefs.getBoolPref(name);
                default:
                    return defaultValue;
            }
        } catch (e) {
            console.error(`Error getting pref ${name}:`, e);
            return defaultValue;
        }
    },
    set(name, value) {
        if (!Services) return;
        try {
            if (typeof value === 'string') {
                Services.prefs.setStringPref(name, value);
            } else if (typeof value === 'number') {
                Services.prefs.setIntPref(name, value);
            } else if (typeof value === 'boolean') {
                Services.prefs.setBoolPref(name, value);
            }
        } catch (e) {
            console.error(`Error setting pref ${name}:`, e);
        }
    },
    has(name) {
        if (!Services) return false;
        try {
            return Services.prefs.getPrefType(name) !== Services.prefs.PREF_INVALID;
        } catch (e) {
            return false;
        }
    },
    resetBranch(name) {
        if (!Services) return;
        try {
            Services.prefs.deleteBranch(name);
        } catch (e) {
            console.error(`Error resetting branch ${name}:`, e);
        }
    }
};
