import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { SiteConfigService } from '../../../services/site-config.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  error = '';
  loading = false;
  siteName = 'CSMACTM';
  logoBase64 = '';

  constructor(
    private authService: AuthService,
    private siteConfigService: SiteConfigService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.siteConfigService.load();
    this.siteConfigService.config$.subscribe(c => {
      this.siteName = c.name;
      this.logoBase64 = c.logoBase64;
    });
  }

  async login(): Promise<void> {
    if (!this.email || !this.password || this.loading) return;
    this.loading = true;
    this.error = '';
    try {
      await this.authService.login(this.email, this.password);
      this.router.navigate(['/admin']);
    } catch {
      this.error = 'Correo o contraseña incorrectos';
    }
    this.loading = false;
  }
}
