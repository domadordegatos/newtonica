import { Injectable } from '@angular/core';
import { Firestore, doc, setDoc, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { SiteConfig } from '../models/site-config.model';

const DOC_PATH = 'config/site';
// Existing installs have no access fields, so defaults keep them fully open.
const DEFAULTS: SiteConfig = {
  name: 'CSMACTM',
  motto: 'Inscripción de Proyectos',
  logoBase64: '',
  accessMode: 'open',
  opensAt: '',
  closedMessage: ''
};

@Injectable({ providedIn: 'root' })
export class SiteConfigService {
  private configSubject = new BehaviorSubject<SiteConfig>(DEFAULTS);
  config$ = this.configSubject.asObservable();
  private loaded = false;

  constructor(private firestore: Firestore) {}

  async load(): Promise<void> {
    if (this.loaded) return;

    return new Promise<void>((resolve) => {
      let first = true;
      onSnapshot(doc(this.firestore, DOC_PATH), (snap) => {
        if (snap.exists()) {
          this.configSubject.next({ ...DEFAULTS, ...snap.data() as SiteConfig });
        }
        if (first) { first = false; this.loaded = true; resolve(); }
      });
    });
  }

  get(): SiteConfig {
    return this.configSubject.value;
  }

  async save(config: SiteConfig): Promise<void> {
    await setDoc(doc(this.firestore, DOC_PATH), config);
  }
}
