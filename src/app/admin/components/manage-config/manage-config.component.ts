import { Component, OnInit } from '@angular/core';
import { SiteConfigService } from '../../../services/site-config.service';
import { SiteConfig, AccessMode } from '../../../models/site-config.model';

@Component({
  selector: 'app-manage-config',
  templateUrl: './manage-config.component.html',
  styleUrls: ['./manage-config.component.scss']
})
export class ManageConfigComponent implements OnInit {
  name = '';
  motto = '';
  logoBase64 = '';
  logoPreview = '';
  accessMode: AccessMode = 'open';
  opensAt = '';
  closedMessage = '';
  saving = false;
  saved = false;
  error = '';

  constructor(private configService: SiteConfigService) {}

  async ngOnInit(): Promise<void> {
    await this.configService.load();
    const config = this.configService.get();
    this.name = config.name;
    this.motto = config.motto;
    this.logoBase64 = config.logoBase64;
    this.logoPreview = config.logoBase64;
    this.accessMode = config.accessMode;
    this.opensAt = config.opensAt;
    this.closedMessage = config.closedMessage;
  }

  /** Preview of what students will see once the countdown expires. */
  get opensAtLabel(): string {
    if (!this.opensAt) return '';
    const d = new Date(this.opensAt);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  get countdownExpired(): boolean {
    if (this.accessMode !== 'countdown' || !this.opensAt) return false;
    const d = new Date(this.opensAt);
    return !isNaN(d.getTime()) && d.getTime() <= Date.now();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    if (file.size > 900 * 1024) {
      alert('La imagen no debe superar los 900KB.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.logoBase64 = reader.result as string;
      this.logoPreview = this.logoBase64;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeLogo(): void {
    this.logoBase64 = '';
    this.logoPreview = '';
  }

  async save(): Promise<void> {
    if (!this.name.trim() || this.saving) return;

    this.error = '';
    if (this.accessMode === 'countdown' && !this.opensAt) {
      this.error = 'Define la fecha y hora de apertura para usar el temporizador.';
      return;
    }

    this.saving = true;
    this.saved = false;

    const config: SiteConfig = {
      name: this.name.trim(),
      motto: this.motto.trim(),
      logoBase64: this.logoBase64,
      accessMode: this.accessMode,
      opensAt: this.opensAt,
      closedMessage: this.closedMessage.trim()
    };
    await this.configService.save(config);
    this.saving = false;
    this.saved = true;
    setTimeout(() => this.saved = false, 3000);
  }
}
