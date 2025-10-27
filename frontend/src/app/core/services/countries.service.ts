import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { CitiesByStateSelect, Countris, StatesbyCountrySelect } from '../../shared/model/countries.model';



@Injectable({
  providedIn: 'root'
})


export class CountriesService {
  private baseUrl = environment.apiBackendUrl;
  constructor(
    private http: HttpClient,
  ) { }

  countriesList(): Observable<Countris[]> {
    return this.http.get<Countris[]>(`${this.baseUrl}/countries`).pipe(
      tap((data) => console.log('Countries data:', data)),
      catchError((error) => {
        console.error('Error fetching countries:', error);
        return throwError(() => error);
      })
    );
  }

  statesByCountry(countryIso2: string): Observable<StatesbyCountrySelect[]> {
    return this.http.get<StatesbyCountrySelect[]>(`${this.baseUrl}/countries/states/iso/${countryIso2}`).pipe(
      tap((data) => console.log('States data:', data)),
      catchError((error) => {
        console.error('Error fetching states:', error);
        return throwError(error);
      })
    );
  }

  citiesByState(countryIso2: string, stateIso2: string): Observable<CitiesByStateSelect[]> {
    return this.http.get<CitiesByStateSelect[]>(`${this.baseUrl}/countries/countries/${countryIso2}/states/${stateIso2}/cities`).pipe(
      tap((data) => console.log('Cities data:', data)),
      catchError((error) => {
        console.error('Error fetching cities:', error);
        return throwError(error);
      })
    );
  }
}
