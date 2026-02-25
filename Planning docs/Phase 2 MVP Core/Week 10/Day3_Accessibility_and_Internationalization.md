# Day 3: Accessibility and Internationalization

## Objective
Implement comprehensive accessibility features and internationalization support for the compliance dashboard, ensuring WCAG 2.1 AA compliance and multi-language support.

## Implementation Steps

1. **Implement Accessibility Features**
   - Add ARIA labels and roles
   - Implement keyboard navigation
   - Add screen reader support
   - Create focus management

2. **Set up Internationalization (i18n)**
   - Configure i18n library
   - Create translation files
   - Implement language switching
   - Add RTL language support

3. **Enhance Component Accessibility**
   - Update existing components with accessibility features
   - Add skip links and navigation landmarks
   - Implement proper color contrast

4. **Test and Validate**
   - Run accessibility audits
   - Test with screen readers
   - Validate i18n implementation

## Code Snippets

### 1. Accessibility Context and Hooks
```tsx
// src/contexts/AccessibilityContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: (key: keyof AccessibilitySettings, value: boolean) => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenReader: false,
    keyboardNavigation: true,
  });

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('accessibility-settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Failed to parse accessibility settings:', error);
      }
    }

    // Detect system preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

    setSettings(prev => ({
      ...prev,
      reducedMotion: prev.reducedMotion || prefersReducedMotion,
      highContrast: prev.highContrast || prefersHighContrast,
    }));
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key: keyof AccessibilitySettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';

    document.body.appendChild(announcement);
    announcement.textContent = message;

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  return (
    <AccessibilityContext.Provider value={{ settings, updateSetting, announceToScreenReader }}>
      {children}
    </AccessibilityContext.Provider>
  );
};
```

### 2. Accessible Button Component
```tsx
// src/components/common/AccessibleButton.tsx
import React, { forwardRef } from 'react';
import { Button, ButtonProps, useTheme } from '@mui/material';
import { useAccessibility } from '../../contexts/AccessibilityContext';

interface AccessibleButtonProps extends ButtonProps {
  'aria-label'?: string;
  'aria-describedby'?: string;
  loading?: boolean;
  loadingText?: string;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ children, 'aria-label': ariaLabel, 'aria-describedby': ariaDescribedBy, loading, loadingText, ...props }, ref) => {
    const { settings } = useAccessibility();
    const theme = useTheme();

    const buttonSx = {
      minHeight: settings.largeText ? '48px' : '36px',
      fontSize: settings.largeText ? '1.125rem' : '0.875rem',
      transition: settings.reducedMotion ? 'none' : theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color']),
      '&:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: '2px',
      },
    };

    return (
      <Button
        ref={ref}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-disabled={loading}
        sx={buttonSx}
        {...props}
      >
        {loading ? (loadingText || 'Loading...') : children}
      </Button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';
```

### 3. Skip Links Component
```tsx
// src/components/common/SkipLinks.tsx
import React from 'react';
import { Box, Link, useTheme } from '@mui/material';
import { useAccessibility } from '../../contexts/AccessibilityContext';

export const SkipLinks: React.FC = () => {
  const { settings } = useAccessibility();
  const theme = useTheme();

  if (!settings.keyboardNavigation) return null;

  const linkSx = {
    position: 'absolute',
    top: '-40px',
    left: '6px',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    padding: '8px',
    textDecoration: 'none',
    borderRadius: '4px',
    zIndex: theme.zIndex.tooltip,
    transition: settings.reducedMotion ? 'none' : 'top 0.3s',
    '&:focus': {
      top: '6px',
    },
  };

  return (
    <Box>
      <Link
        href="#main-content"
        sx={linkSx}
        onFocus={(e) => {
          e.currentTarget.style.top = '6px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.top = '-40px';
        }}
      >
        Skip to main content
      </Link>
      <Link
        href="#navigation"
        sx={{ ...linkSx, left: 'auto', right: '6px' }}
        onFocus={(e) => {
          e.currentTarget.style.top = '6px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.top = '-40px';
        }}
      >
        Skip to navigation
      </Link>
    </Box>
  );
};
```

### 4. Internationalization Setup
```tsx
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Import translation files
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import zh from './locales/zh.json';
import ar from './locales/ar.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  zh: { translation: zh },
  ar: { translation: ar },
};

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;
```

### 5. Translation Files Structure
```json
// src/i18n/locales/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success",
    "warning": "Warning",
    "info": "Information"
  },
  "dashboard": {
    "title": "Compliance Dashboard",
    "widgets": {
      "kpi": "KPI Card",
      "chart": "Chart",
      "table": "Data Table",
      "map": "Geographic Map",
      "alerts": "Alert Summary"
    },
    "actions": {
      "editLayout": "Edit Layout",
      "saveLayout": "Save Layout",
      "addWidget": "Add Widget",
      "removeWidget": "Remove Widget"
    }
  },
  "compliance": {
    "status": {
      "compliant": "Compliant",
      "nonCompliant": "Non-Compliant",
      "pending": "Pending Review",
      "underReview": "Under Review"
    },
    "risk": {
      "low": "Low Risk",
      "medium": "Medium Risk",
      "high": "High Risk",
      "critical": "Critical Risk"
    }
  },
  "accessibility": {
    "highContrast": "High Contrast",
    "largeText": "Large Text",
    "reducedMotion": "Reduced Motion",
    "screenReader": "Screen Reader Mode",
    "keyboardNavigation": "Keyboard Navigation"
  }
}
```

```json
// src/i18n/locales/es.json
{
  "common": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "add": "Agregar",
    "loading": "Cargando...",
    "error": "Error",
    "success": "Éxito",
    "warning": "Advertencia",
    "info": "Información"
  },
  "dashboard": {
    "title": "Panel de Cumplimiento",
    "widgets": {
      "kpi": "Tarjeta KPI",
      "chart": "Gráfico",
      "table": "Tabla de Datos",
      "map": "Mapa Geográfico",
      "alerts": "Resumen de Alertas"
    },
    "actions": {
      "editLayout": "Editar Diseño",
      "saveLayout": "Guardar Diseño",
      "addWidget": "Agregar Widget",
      "removeWidget": "Eliminar Widget"
    }
  },
  "compliance": {
    "status": {
      "compliant": "Cumpliente",
      "nonCompliant": "No Cumpliente",
      "pending": "Pendiente de Revisión",
      "underReview": "En Revisión"
    },
    "risk": {
      "low": "Riesgo Bajo",
      "medium": "Riesgo Medio",
      "high": "Riesgo Alto",
      "critical": "Riesgo Crítico"
    }
  },
  "accessibility": {
    "highContrast": "Alto Contraste",
    "largeText": "Texto Grande",
    "reducedMotion": "Movimiento Reducido",
    "screenReader": "Modo Lector de Pantalla",
    "keyboardNavigation": "Navegación por Teclado"
  }
}
```

### 6. Language Switcher Component
```tsx
// src/components/common/LanguageSwitcher.tsx
import React from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  SelectChangeEvent,
  Box,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { AccessibleButton } from './AccessibleButton';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (event: SelectChangeEvent<string>) => {
    const language = event.target.value;
    i18n.changeLanguage(language);

    // Announce language change to screen readers
    const selectedLang = languages.find(lang => lang.code === language);
    if (selectedLang) {
      // You would use the accessibility context here
      console.log(`Language changed to ${selectedLang.nativeName}`);
    }
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <Select
        value={i18n.language}
        onChange={handleLanguageChange}
        displayEmpty
        inputProps={{
          'aria-label': t('common.language', 'Select language'),
        }}
        sx={{
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          },
        }}
      >
        {languages.map((language) => (
          <MenuItem key={language.code} value={language.code}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">{language.nativeName}</Typography>
              <Typography variant="caption" color="text.secondary">
                ({language.name})
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
```

### 7. Accessibility Settings Panel
```tsx
// src/components/settings/AccessibilitySettings.tsx
import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { AccessibleButton } from '../common/AccessibleButton';

export const AccessibilitySettings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateSetting } = useAccessibility();

  const handleSettingChange = (setting: keyof typeof settings) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    updateSetting(setting, event.target.checked);
  };

  return (
    <Card>
      <CardHeader
        title={t('accessibility.settings', 'Accessibility Settings')}
        titleTypographyProps={{ variant: 'h6' }}
      />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.highContrast}
                onChange={handleSettingChange('highContrast')}
                inputProps={{
                  'aria-label': t('accessibility.highContrast', 'High contrast mode'),
                }}
              />
            }
            label={
              <Box>
                <Typography variant="body1">
                  {t('accessibility.highContrast', 'High Contrast')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('accessibility.highContrastDesc', 'Increase contrast for better visibility')}
                </Typography>
              </Box>
            }
          />

          <Divider />

          <FormControlLabel
            control={
              <Switch
                checked={settings.largeText}
                onChange={handleSettingChange('largeText')}
                inputProps={{
                  'aria-label': t('accessibility.largeText', 'Large text mode'),
                }}
              />
            }
            label={
              <Box>
                <Typography variant="body1">
                  {t('accessibility.largeText', 'Large Text')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('accessibility.largeTextDesc', 'Increase text size for better readability')}
                </Typography>
              </Box>
            }
          />

          <Divider />

          <FormControlLabel
            control={
              <Switch
                checked={settings.reducedMotion}
                onChange={handleSettingChange('reducedMotion')}
                inputProps={{
                  'aria-label': t('accessibility.reducedMotion', 'Reduced motion mode'),
                }}
              />
            }
            label={
              <Box>
                <Typography variant="body1">
                  {t('accessibility.reducedMotion', 'Reduced Motion')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('accessibility.reducedMotionDesc', 'Minimize animations and transitions')}
                </Typography>
              </Box>
            }
          />

          <Divider />

          <FormControlLabel
            control={
              <Switch
                checked={settings.screenReader}
                onChange={handleSettingChange('screenReader')}
                inputProps={{
                  'aria-label': t('accessibility.screenReader', 'Screen reader mode'),
                }}
              />
            }
            label={
              <Box>
                <Typography variant="body1">
                  {t('accessibility.screenReader', 'Screen Reader Mode')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('accessibility.screenReaderDesc', 'Optimize interface for screen readers')}
                </Typography>
              </Box>
            }
          />

          <Divider />

          <FormControlLabel
            control={
              <Switch
                checked={settings.keyboardNavigation}
                onChange={handleSettingChange('keyboardNavigation')}
                inputProps={{
                  'aria-label': t('accessibility.keyboardNavigation', 'Keyboard navigation mode'),
                }}
              />
            }
            label={
              <Box>
                <Typography variant="body1">
                  {t('accessibility.keyboardNavigation', 'Keyboard Navigation')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('accessibility.keyboardNavigationDesc', 'Enable full keyboard navigation')}
                </Typography>
              </Box>
            }
          />
        </Box>

        <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('accessibility.note', 'Note: These settings are saved locally and will persist across sessions.')}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
```

### 8. RTL Support Hook
```tsx
// src/hooks/useRTL.ts
import { useTranslation } from 'react-i18next';

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

export const useRTL = () => {
  const { i18n } = useTranslation();
  const isRTL = RTL_LANGUAGES.includes(i18n.language);

  return {
    isRTL,
    direction: isRTL ? 'rtl' : 'ltr',
  };
};
```

### 9. Updated App Component with Accessibility and i18n
```tsx
// src/App.tsx
import React from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { SkipLinks } from './components/common/SkipLinks';
import { LanguageSwitcher } from './components/common/LanguageSwitcher';
import { DashboardManager } from './components/dashboard/DashboardManager';
import { createAppTheme } from './theme';
import { useRTL } from './hooks/useRTL';

const AppContent: React.FC = () => {
  const { direction } = useRTL();
  const theme = createAppTheme(direction);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          direction,
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <SkipLinks />
        <Router>
          <Box
            component="header"
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: theme.zIndex.appBar,
              backgroundColor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
              p: 2,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box component="nav" id="navigation" aria-label="Main navigation">
                {/* Navigation items */}
              </Box>
              <LanguageSwitcher />
            </Box>
          </Box>

          <Box
            component="main"
            id="main-content"
            role="main"
            sx={{
              flex: 1,
              p: 2,
            }}
          >
            <Routes>
              <Route path="/" element={<DashboardManager />} />
              <Route path="/settings" element={<AccessibilitySettings />} />
              {/* Other routes */}
            </Routes>
          </Box>
        </Router>
      </Box>
    </ThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <I18nextProvider i18n={i18n}>
      <AccessibilityProvider>
        <AppContent />
      </AccessibilityProvider>
    </I18nextProvider>
  );
};

export default App;
```

## Notes
- Comprehensive accessibility features including ARIA labels, keyboard navigation, and screen reader support
- Internationalization support for multiple languages including RTL languages
- Accessibility settings panel allows users to customize their experience
- Skip links and proper semantic HTML structure for better navigation
- Theme adaptation for RTL languages and accessibility preferences