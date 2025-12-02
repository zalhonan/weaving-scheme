/**
 * JSON replacer for Map serialization.
 * Converts Map to { __type: 'Map', entries: [...] }
 */
export function mapReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return {
      __type: 'Map',
      entries: Array.from(value.entries()),
    };
  }
  return value;
}

/**
 * JSON reviver for Map deserialization.
 */
interface SerializedMap {
  __type: 'Map';
  entries: [string, unknown][];
}

function isSerializedMap(value: unknown): value is SerializedMap {
  return (
    value !== null &&
    typeof value === 'object' &&
    '__type' in value &&
    (value as SerializedMap).__type === 'Map' &&
    'entries' in value &&
    Array.isArray((value as SerializedMap).entries)
  );
}

export function mapReviver(_key: string, value: unknown): unknown {
  if (isSerializedMap(value)) {
    return new Map(value.entries);
  }
  return value;
}
