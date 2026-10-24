/** A table in another language: exactly the keys of the English one, each a string. */
export type Translated<T> = { [K in keyof T]: string };
