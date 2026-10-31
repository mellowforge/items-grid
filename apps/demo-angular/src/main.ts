import { bootstrapApplication } from '@angular/platform-browser';
import { restoreTheme } from 'demo-shared';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// The light/dark choice made on the landing page (or another demo) carries over.
restoreTheme();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
