/**
 * Replace all %KEY% placeholders in a string.
 * Keys are case-insensitive: %nombre% and %NOMBRE% both work.
 *
 * @param {string} template - e.g. "Hola %APODO%, tu rol es %ROL%."
 * @param {Record<string, string>} values - e.g. { APODO: "Juan", ROL: "Admin" }
 * @returns {string}
 */
export function applyPlaceholders(template, values = {}) {
    return Object.entries(values).reduce(
        (text, [key, value]) => text.replaceAll(`%${key.toUpperCase()}%`, value ?? ''),
        template
    );
}
