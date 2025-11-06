import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PostsService {

    private apiUrl = `${environment.apiBackendUrl}/donation`;

  constructor(private http: HttpClient) { }
}
