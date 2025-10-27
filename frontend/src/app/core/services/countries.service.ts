import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, tap, throwError } from 'rxjs';

export interface Countris{
 id?:number,
 name?:string,
 iso2?:string,
 iso3?:string,
 phonecode?:string,
 capital?:string,
 currency?:string,
 native?:string,
 emoji? : string,
}

export interface StatesbyCountrySelect{
  id?:number,
  name?:string,
  iso2?:string,
}

export interface CitiesByStateSelect{
  id?:number,
  name?:string,
}

@Injectable({
  providedIn: 'root'
})


export class CountriesService {
  private baseUrl= environment.apiBackendUrl;
  constructor(
    private http: HttpClient,
  ) { }

  countriesList(): Observable<Countris[]> {
    return this.http.get<Countris[]>(`${this.baseUrl}/countries`).pipe(
      tap((data) => console.log('Countries data:', data)),
      catchError((error) => {
        console.error('Error fetching countries:', error);
        return throwError(error);
      })
    );
  }
}
