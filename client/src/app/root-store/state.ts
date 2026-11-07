/* As mentioned, we treat each reducer like a table in a database. This means
* our top level state interface is just a map of keys to inner state types.
*/

/* TODO: Force the linter to ignore empty interfaces for now, once we
* add a root level state we can remove this.*/

/* eslint-disable @typescript-eslint/no-empty-object-type */
export interface State {
}
