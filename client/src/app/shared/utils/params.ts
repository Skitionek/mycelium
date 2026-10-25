import { PaginatedRequestOptions } from '../schemas/common';

export function getChoicesFromQuery<T>(params: { [key: string]: string }, key: string, choicesMap: Map<string, T>): T[] {
  if (params.hasOwnProperty(key)) {
    if (params[key] === '') {
      return [];
    } else {
      const choices: T[] = [];
      for (const id of params[key].split(';')) {
        const choice = choicesMap.get(id);
        if (choice != null) {
          choices.push(choice);
        }
      }
      return choices;
    }
  } else {
    return null;
  }
}

/**
 * Parse a positive integer from the URL, which a user can edit to anything.
 */
function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = value ? parseInt(value, 10) : NaN;
  return parsed > 0 ? parsed : fallback;
}

export const deserializePaginatedParams = (
  {page, limit, sort = ''}: { [key in keyof PaginatedRequestOptions]?: string },
  defaultLimit: number
): Required<PaginatedRequestOptions> => ({
  page: parsePositiveInt(page, 1),
  limit: parsePositiveInt(limit, defaultLimit),
  sort
});

export function serializePaginatedParams<O extends PaginatedRequestOptions>(
  params: O, restartPagination: boolean): Record<keyof PaginatedRequestOptions, string> {
  return params != null ? {
    page: restartPagination ? '1' : (params.page != null ? params.page + '' : ''),
    limit: params.limit != null ? params.limit + '' : '',
    sort: params.sort != null ? params.sort : '',
  } : {
    page: '1',
    limit: '50',
    sort: '',
  };
}
