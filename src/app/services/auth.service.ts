import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();
  private ready = false;
  private readyPromise: Promise<void>;

  constructor(private auth: Auth) {
    this.readyPromise = new Promise(resolve => {
      onAuthStateChanged(this.auth, user => {
        this.userSubject.next(user);
        if (!this.ready) {
          this.ready = true;
          resolve();
        }
      });
    });
  }

  async waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  get isLoggedIn(): boolean {
    return !!this.userSubject.value;
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
