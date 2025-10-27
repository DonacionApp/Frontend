export interface Countris {
  id?: number,
  name?: string,
  iso2?: string,
  iso3?: string,
  phonecode?: string,
  capital?: string,
  currency?: string,
  native?: string,
  emoji?: string,
}

export interface StatesbyCountrySelect {
  id?: number,
  name?: string,
  iso2?: string,
}

export interface CitiesByStateSelect {
  id?: number,
  name?: string,
}