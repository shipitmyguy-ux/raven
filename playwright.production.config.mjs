import {defineConfig} from '@playwright/test';
import regression from './playwright.config.mjs';

// Deployed-page checks run after publication, independently of local browser QA.
export default defineConfig({...regression,testMatch:'**/production-smoke.spec.mjs',testIgnore:[],webServer:undefined});
