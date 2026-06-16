import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { View, SplitLayout, SplitCol, Button, Group, Header, Panel, PanelHeader, FormItem, Input, Checkbox } from '@vkontakte/vkui';
import { useActiveVkuiLocation, useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import { useAuth } from './contexts/AuthContext';
import { authApi } from './api/endpoints';
import { LegalInformation } from './components/LegalInformation';
import { PERSONAL_DATA_CONSENT_VERSION } from './legalDocuments';
import './App.css';

import { Home, AdminDashboard, EmployeeDashboard, ClientDashboard } from './panels';
import { ADMIN_PANELS, EMPLOYEE_PANELS, CLIENT_PANELS, DEFAULT_VIEW_PANELS } from './routes';

const getDashboardPanelByRole = (role) => (
  role === 'admin'
    ? ADMIN_PANELS.DASHBOARD
    : role === 'groomer'
      ? EMPLOYEE_PANELS.DASHBOARD
      : CLIENT_PANELS.DASHBOARD
);

const PANEL_ROLE_ACCESS = {
  [ADMIN_PANELS.DASHBOARD]: 'admin',
  [ADMIN_PANELS.ORDERS]: 'admin',
  [ADMIN_PANELS.EMPLOYEES]: 'admin',
  [EMPLOYEE_PANELS.DASHBOARD]: 'groomer',
  [EMPLOYEE_PANELS.ORDERS]: 'groomer',
  [CLIENT_PANELS.DASHBOARD]: ['client', 'admin', 'groomer'],
  [CLIENT_PANELS.ORDERS]: ['client', 'admin', 'groomer'],
  [CLIENT_PANELS.PROFILE]: ['client', 'admin', 'groomer'],
};

const ROLE_LABELS = {
  client: 'Клиент',
  groomer: 'Грумер',
  admin: 'Администратор',
};

const EMPTY_AUTH_FORM = {
  vkId: '',
  fullName: '',
  phone: '',
};

const VK_ID_LENGTH = 9;
const PHONE_LENGTH = 11;
const VK_ID_TEMPLATE = '123456789';
const FULL_NAME_TEMPLATE = 'Иван Иванов';
const FULL_NAME_PATTERN = '[A-Za-zА-Яа-яЁё-]+\\s+[A-Za-zА-Яа-яЁё-]+';

const normalizeVkIdInput = (value) => String(value || '').replace(/\D/g, '').slice(0, VK_ID_LENGTH);
const isValidVkId = (value) => /^\d{9}$/.test(String(value || ''));

const capitalizeWord = (word) => {
  const lower = String(word || '').toLocaleLowerCase('ru-RU');
  return lower ? `${lower.slice(0, 1).toLocaleUpperCase('ru-RU')}${lower.slice(1)}` : '';
};

const normalizeFullNameInput = (value) => String(value || '')
  .replace(/[^A-Za-zА-Яа-яЁё\s-]/g, '')
  .replace(/\s+/g, ' ')
  .trimStart()
  .split(' ')
  .slice(0, 2)
  .map((part) => part
    .split('-')
    .map(capitalizeWord)
    .join('-'))
  .join(' ');

const normalizeFullNameForSubmit = (value) => normalizeFullNameInput(value).trim();
const isValidFullName = (value) => normalizeFullNameForSubmit(value).split(' ').filter(Boolean).length === 2;

const getPhoneDigits = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('8')) return `7${digits.slice(1, PHONE_LENGTH)}`;
  if (digits.startsWith('7')) return digits.slice(0, PHONE_LENGTH);
  return `7${digits}`.slice(0, PHONE_LENGTH);
};

const formatPhoneInput = (value) => {
  const digits = getPhoneDigits(value);
  if (!digits) return '';

  const operator = digits.slice(1, 4);
  const middle = digits.slice(4, 7);
  const firstPair = digits.slice(7, 9);
  const secondPair = digits.slice(9, 11);

  let formatted = '+7';
  if (operator) formatted += ` (${operator}`;
  if (operator.length === 3) formatted += ')';
  if (middle) formatted += ` ${middle}`;
  if (firstPair) formatted += `-${firstPair}`;
  if (secondPair) formatted += `-${secondPair}`;
  return formatted;
};

const normalizePhoneInput = formatPhoneInput;
const isValidPhone = (value) => /^7\d{10}$/.test(getPhoneDigits(value));

const AuthScreen = ({ eyebrow, title, subtitle, children }) => (
  <div className="auth-page">
    <section className="auth-hero">
      <div>
        <div className="auth-hero-kicker">{eyebrow}</div>
        <h1 className="auth-hero-title">{title}</h1>
        <p className="auth-hero-subtitle">{subtitle}</p>
      </div>
    </section>
    <div className="auth-content">
      {children}
    </div>
  </div>
);

const AuthNotice = ({ title, children, tone = 'default' }) => (
  <div className={`auth-notice auth-notice-${tone}`}>
    <div className="auth-notice-title">{title}</div>
    {children ? <div className="auth-notice-text">{children}</div> : null}
  </div>
);

const RoleCard = ({ role, title, description, onClick }) => (
  <button type="button" className={`auth-role-card auth-role-${role}`} onClick={onClick}>
    <span className="auth-role-mark">{title.slice(0, 1)}</span>
    <span className="auth-role-copy">
      <span className="auth-role-title">{title}</span>
      <span className="auth-role-description">{description}</span>
    </span>
  </button>
);

export const App = () => {
  const { panel: activePanel } = useActiveVkuiLocation();
  const [fetchedUser, setUser] = useState();
  const [popout, setPopout] = useState(null);
  const { login, user: authUser, switchRole } = useAuth();
  const routeNavigator = useRouteNavigator();
  const [availableRoles, setAvailableRoles] = useState([]);
  const [rolesResolved, setRolesResolved] = useState(false);
  const [devAuthForm, setDevAuthForm] = useState(EMPTY_AUTH_FORM);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authDiscovery, setAuthDiscovery] = useState(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const [showLegalInfo, setShowLegalInfo] = useState(false);
  const [manualLogout, setManualLogout] = useState(() => sessionStorage.getItem('grooming:manualLogout') === '1');

  const resetAuthScreen = React.useCallback(() => {
    setAvailableRoles([]);
    setRolesResolved(false);
    setDevAuthForm(EMPTY_AUTH_FORM);
    setNeedsRegistration(false);
    setAuthError('');
    setAuthDiscovery(null);
    setAuthChecking(false);
    setPersonalDataConsent(false);
    setShowLegalInfo(false);
  }, []);

  useEffect(() => {
    if (!authUser && activePanel !== DEFAULT_VIEW_PANELS.LOGIN) {
      routeNavigator.push('/login');
    }
  }, [authUser, activePanel, routeNavigator]);

  React.useLayoutEffect(() => {
    if (activePanel !== DEFAULT_VIEW_PANELS.LOGIN && activePanel !== DEFAULT_VIEW_PANELS.ROLE_MENU) {
      return;
    }

    const resetAuthScroll = () => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      [document.scrollingElement, document.documentElement, document.body]
        .filter(Boolean)
        .forEach((node) => {
          node.scrollTop = 0;
        });

      document
        .querySelectorAll('.vkuiRoot, .vkuiSplitLayout, .vkuiSplitCol, .vkuiSplitCol__inner, .vkuiView, .vkuiView__panel, .vkuiView__panel-in, .vkuiPanel, .vkuiPanel__in, [class*="Root"], [class*="SplitCol"], [class*="View"], [class*="Panel"]')
        .forEach((node) => {
          node.scrollTop = 0;
          if (typeof node.scrollTo === 'function') {
            node.scrollTo({ top: 0, behavior: 'auto' });
          }
        });
    };

    const previousScrollRestoration = window.history.scrollRestoration;
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    resetAuthScroll();
    const frameId = window.requestAnimationFrame(resetAuthScroll);
    const timeoutIds = [0, 80, 240].map((delay) => window.setTimeout(resetAuthScroll, delay));

    return () => {
      window.cancelAnimationFrame(frameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      if ('scrollRestoration' in window.history) {
        try {
          window.history.scrollRestoration = previousScrollRestoration;
        } catch (_error) {
          window.history.scrollRestoration = 'auto';
        }
      }
    };
  }, [activePanel]);

  useEffect(() => {
    const handleLogout = () => {
      resetAuthScreen();
      setManualLogout(true);
    };

    window.addEventListener('grooming:logout', handleLogout);

    return () => {
      window.removeEventListener('grooming:logout', handleLogout);
    };
  }, [resetAuthScreen]);

  useEffect(() => {
    const loadRoles = async () => {
      if (!authUser) {
        setAvailableRoles([]);
        setRolesResolved(false);
        return;
      }

      try {
        const data = await authApi.getRoles();
        setAvailableRoles(Array.isArray(data?.roles) ? data.roles : [authUser.role]);
      } catch (_error) {
        setAvailableRoles([authUser.role]);
      } finally {
        setRolesResolved(true);
      }
    };

    loadRoles();
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !rolesResolved) {
      return;
    }

    if (activePanel === DEFAULT_VIEW_PANELS.LOGIN || activePanel === DEFAULT_VIEW_PANELS.HOME) {
      const target = availableRoles.length > 1
        ? DEFAULT_VIEW_PANELS.ROLE_MENU
        : getDashboardPanelByRole(authUser.role);

      setTimeout(() => {
        routeNavigator.push(`/${target}`);
      }, 100);
    }
  }, [authUser, activePanel, routeNavigator, availableRoles, rolesResolved]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    const requiredRole = PANEL_ROLE_ACCESS[activePanel];

    if (requiredRole && Array.isArray(requiredRole) && !requiredRole.includes(authUser.role)) {
      routeNavigator.push(`/${getDashboardPanelByRole(authUser.role)}`);
      return;
    }

    if (requiredRole && typeof requiredRole === 'string' && authUser.role !== requiredRole) {
      routeNavigator.push(`/${getDashboardPanelByRole(authUser.role)}`);
    }
  }, [authUser, activePanel, routeNavigator]);

  useEffect(() => {
    if (!bridge.isWebView()) {
      setPopout(null);
      return;
    }

    const fetchData = async () => {
      if (authUser) {
        setPopout(null);
        return;
      }

      if (manualLogout) {
        setPopout(null);
        return;
      }

      try {
        const vkUser = await bridge.send('VKWebAppGetUserInfo');
        setUser(vkUser);

        setAuthChecking(true);
        const fullName = `${vkUser.first_name} ${vkUser.last_name}`.trim();
        const discovery = await authApi.discover({
          vkId: vkUser.id,
          fullName,
        });

        setAuthDiscovery(discovery);
        setNeedsRegistration(discovery?.status === 'needs_registration');
        setPersonalDataConsent(false);
        if (discovery?.status === 'name_mismatch') {
          setAuthError(discovery.error || 'VK ID найден, но имя и фамилия не совпадают');
          setAuthDiscovery(null);
          return;
        }

        setDevAuthForm((prev) => ({
          ...prev,
          vkId: String(vkUser.id || prev.vkId),
          fullName: discovery?.fullName || fullName || prev.fullName,
          phone: discovery?.status === 'needs_registration' || discovery?.phoneMissingForClient ? '' : prev.phone,
        }));

        if (discovery?.status === 'client_found' && !discovery?.phoneMissing) {
          const loginResult = await login({
            vkId: vkUser.id,
            fullName: discovery?.fullName || fullName,
          });

          if (!loginResult.success) {
            setAuthError(loginResult.error || 'Не удалось выполнить вход');
          }
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
        setAuthError('Не удалось получить профиль VK');
      } finally {
        setAuthChecking(false);
        setPopout(null);
      }
    };

    const timer = setTimeout(() => {
      fetchData();
    }, 100);

    return () => clearTimeout(timer);
  }, [authUser, login, manualLogout]);

  const handleStartVkLogin = () => {
    sessionStorage.removeItem('grooming:manualLogout');
    setManualLogout(false);
  };

  const updateDevAuthField = (field, value) => {
    const normalizers = {
      vkId: normalizeVkIdInput,
      fullName: normalizeFullNameInput,
      phone: normalizePhoneInput,
    };
    const nextValue = normalizers[field] ? normalizers[field](value) : value;
    setDevAuthForm((prev) => ({ ...prev, [field]: nextValue }));
  };

  const validateManualAuthForm = () => {
    if (!isValidVkId(devAuthForm.vkId)) {
      setAuthError('VK ID должен состоять ровно из 9 цифр');
      return false;
    }

    if (!isValidFullName(devAuthForm.fullName)) {
      setAuthError('Введите имя и фамилию двумя отдельными словами');
      return false;
    }

    return true;
  };

  const validatePhoneIfRequired = () => {
    if (!isValidPhone(devAuthForm.phone)) {
      setAuthError('Телефон должен состоять ровно из 11 цифр, например 79991234567');
      return false;
    }

    return true;
  };

  const handleDevLogin = async () => {
    try {
      setAuthError('');
      if (!validateManualAuthForm()) {
        return;
      }

      const fullName = normalizeFullNameForSubmit(devAuthForm.fullName);
      const discovery = await authApi.discover({
        vkId: Number(devAuthForm.vkId),
        fullName,
      });

      setAuthDiscovery(discovery);
      setNeedsRegistration(discovery?.status === 'needs_registration');
      setPersonalDataConsent(false);
      if (discovery?.status === 'name_mismatch') {
        setAuthError(discovery.error || 'VK ID найден, но имя и фамилия не совпадают');
        setAuthDiscovery(null);
        return;
      }

      setDevAuthForm((prev) => ({
        ...prev,
        fullName: discovery?.fullName || prev.fullName,
        phone: discovery?.status === 'needs_registration' || discovery?.phoneMissingForClient ? '' : prev.phone,
      }));

      if (discovery?.status === 'needs_registration' || discovery?.phoneMissing || discovery?.phoneMissingForClient) {
        return;
      }

      const loginResult = await login({
        vkId: Number(devAuthForm.vkId),
        fullName: discovery?.fullName || fullName,
      });

      if (!loginResult.success) {
        setAuthError(loginResult.error || 'Не удалось выполнить вход');
        return;
      }

      setNeedsRegistration(false);
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('Не удалось выполнить вход');
    }
  };

  const handleContinueLogin = async () => {
    try {
      setAuthError('');
      const shouldSendPhone = needsRegistration || authDiscovery?.phoneMissing || authDiscovery?.phoneMissingForClient;
      const shouldRequireConsent = authDiscovery?.status === 'needs_registration'
        || (authDiscovery?.phoneMissingForClient && authDiscovery?.clientProfileExists === false);

      if (shouldSendPhone && !validatePhoneIfRequired()) {
        return;
      }

      if (shouldRequireConsent && !personalDataConsent) {
        setAuthError('Для первичной регистрации нужно согласие на обработку персональных данных');
        return;
      }

      const loginResult = await login({
        vkId: Number(devAuthForm.vkId),
        fullName: normalizeFullNameForSubmit(devAuthForm.fullName),
        phone: shouldSendPhone ? getPhoneDigits(devAuthForm.phone) : undefined,
        personalDataConsent: shouldRequireConsent ? true : undefined,
        personalDataConsentVersion: shouldRequireConsent ? PERSONAL_DATA_CONSENT_VERSION : undefined,
      });

      if (loginResult.needsRegistration) {
        setNeedsRegistration(true);
        return;
      }

      if (!loginResult.success) {
        setAuthError(loginResult.error || 'Не удалось выполнить вход');
        return;
      }

      setNeedsRegistration(false);
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('Не удалось выполнить вход');
    }
  };

  const renderPersonalDataConsent = () => (
    <div className="auth-legal-box">
      <Checkbox
        checked={personalDataConsent}
        onChange={(event) => setPersonalDataConsent(event.target.checked)}
      >
        Я согласен на обработку персональных данных
      </Checkbox>
      <div className="auth-legal-hint">
        Согласие включает ФИО, телефон, VK ID, сведения о питомцах и историю записей.
      </div>
      <Button
        mode="tertiary"
        size="m"
        className="auth-legal-toggle"
        onClick={() => setShowLegalInfo((prev) => !prev)}
      >
        {showLegalInfo ? 'Скрыть правовую информацию' : 'Показать правовую информацию'}
      </Button>
      {showLegalInfo ? <LegalInformation compact /> : null}
    </div>
  );

  const renderPhoneInput = () => (
    <Input
      value={devAuthForm.phone}
      type="tel"
      inputMode="numeric"
      pattern="\\+7 \\(\\d{3}\\) \\d{3}-\\d{2}-\\d{2}"
      maxLength={18}
      onChange={(e) => updateDevAuthField('phone', e.target.value)}
      placeholder="+7 (999) 123-45-67"
    />
  );

  const handleRoleSelect = async (role, panel) => {
    setAuthError('');
    const result = await switchRole(role);
    if (result.success) {
      routeNavigator.push(`/${panel}`);
      return;
    }

    setAuthError(result.error || 'Не удалось переключить роль');
  };

  const renderLoginPanel = () => {
    if (bridge.isWebView()) {
      return (
        <AuthScreen
          eyebrow="Grooming salon"
          title="Вход и регистрация"
          subtitle="Проверим профиль VK, найдём ваши роли и при необходимости попросим только недостающие данные."
        >
          <Group className="auth-group" header={<Header mode="secondary">Авторизация</Header>}>
            {authChecking ? (
              <AuthNotice title="Проверяем профиль">Ищем клиента, сотрудника и доступные роли.</AuthNotice>
            ) : null}

            {!authChecking && manualLogout ? (
              <>
                <AuthNotice title="Вы вышли из профиля">
                  Для нового входа снова проверьте профиль VK.
                </AuthNotice>
                <FormItem>
                  <Button stretched size="l" onClick={handleStartVkLogin}>
                    Войти
                  </Button>
                </FormItem>
              </>
            ) : null}

            {!authChecking && !manualLogout && authDiscovery?.status === 'employee_found' ? (
              <>
                <AuthNotice title={`Найден сотрудник: ${devAuthForm.fullName || 'Пользователь'}`}>
                  Доступные роли: {(authDiscovery.availableRoles || []).map((role) => ROLE_LABELS[role] || role).join(', ')}
                </AuthNotice>
                {authDiscovery?.phoneMissingForClient ? (
                  <FormItem top="Телефон для клиентского раздела">
                    {renderPhoneInput()}
                  </FormItem>
                ) : null}
                {authDiscovery?.phoneMissingForClient && authDiscovery?.clientProfileExists === false
                  ? renderPersonalDataConsent()
                  : null}
              <FormItem>
                <Button
                  stretched
                  size="l"
                  onClick={handleContinueLogin}
                  disabled={authDiscovery?.phoneMissingForClient && (!isValidPhone(devAuthForm.phone) || (authDiscovery?.clientProfileExists === false && !personalDataConsent))}
                >
                  Открыть доступные разделы
                </Button>
              </FormItem>
            </>
          ) : null}

            {!authChecking && !manualLogout && authDiscovery?.status === 'client_found' ? (
              <>
                <AuthNotice title={`Найден клиент: ${devAuthForm.fullName || 'Пользователь'}`}>
                  Продолжим в клиентский раздел.
                </AuthNotice>
              {authDiscovery?.phoneMissing || authDiscovery?.phoneMissingForClient ? (
                <FormItem top="Телефон">
                  {renderPhoneInput()}
                </FormItem>
              ) : null}
              <FormItem>
                <Button
                  stretched
                  size="l"
                  onClick={handleContinueLogin}
                  disabled={(authDiscovery?.phoneMissing || authDiscovery?.phoneMissingForClient) && !isValidPhone(devAuthForm.phone)}
                >
                  {(authDiscovery?.phoneMissing || authDiscovery?.phoneMissingForClient)
                    ? 'Сохранить телефон и продолжить'
                    : 'Открыть клиентский раздел'}
                </Button>
              </FormItem>
            </>
          ) : null}

            {!authChecking && !manualLogout && authDiscovery?.status === 'needs_registration' ? (
              <>
                <AuthNotice title="Нужно завершить регистрацию" tone="accent">
                  Профиль VK найден. Добавьте телефон, чтобы создать клиентский профиль.
                </AuthNotice>
              <FormItem top="Имя и фамилия">
                <Input value={devAuthForm.fullName} readOnly />
              </FormItem>
              <FormItem top="Телефон">
                {renderPhoneInput()}
              </FormItem>
              {renderPersonalDataConsent()}
              <FormItem>
                <Button stretched size="l" onClick={handleContinueLogin} disabled={!isValidPhone(devAuthForm.phone) || !personalDataConsent}>
                  Привязать и продолжить
                </Button>
              </FormItem>
            </>
          ) : null}

            {authError ? <AuthNotice title="Не получилось войти" tone="error">{authError}</AuthNotice> : null}
          </Group>
        </AuthScreen>
      );
    }

    return (
      <AuthScreen
        eyebrow="Dev mode"
        title="Вход и регистрация"
        subtitle="В мини-приложении VK ID и имя придут автоматически. Здесь можно проверить сценарии входа, выбора роли и дорегистрации."
      >
        <Group className="auth-group" header={<Header mode="secondary">Режим разработки</Header>}>
          <AuthNotice title="Тестовый вход">VK ID и ФИО в боевом режиме будут получены из профиля VK.</AuthNotice>

        {!authDiscovery ? (
          <>
            <FormItem top="Тестовый VK ID">
              <Input
                value={devAuthForm.vkId}
                type="text"
                inputMode="numeric"
                pattern={`\\d{${VK_ID_LENGTH}}`}
                maxLength={VK_ID_LENGTH}
                placeholder={VK_ID_TEMPLATE}
                onChange={(e) => updateDevAuthField('vkId', e.target.value)}
              />
            </FormItem>
            <FormItem top="Имя и фамилия">
              <Input
                value={devAuthForm.fullName}
                readOnly={authDiscovery?.status === 'employee_found'}
                pattern={FULL_NAME_PATTERN}
                placeholder={FULL_NAME_TEMPLATE}
                onChange={(e) => updateDevAuthField('fullName', e.target.value)}
              />
            </FormItem>
            {authError ? <AuthNotice title="Не получилось войти" tone="error">{authError}</AuthNotice> : null}
            <FormItem>
              <Button stretched size="l" onClick={handleDevLogin} disabled={!isValidVkId(devAuthForm.vkId) || !isValidFullName(devAuthForm.fullName)}>
                Продолжить
              </Button>
            </FormItem>
          </>
        ) : null}

        {authDiscovery?.status === 'employee_found' ? (
          <>
            <AuthNotice title={`Найден сотрудник: ${devAuthForm.fullName || 'Пользователь'}`}>
              Доступные роли: {(authDiscovery.availableRoles || []).map((role) => ROLE_LABELS[role] || role).join(', ')}
            </AuthNotice>
            {authDiscovery?.phoneMissingForClient ? (
              <FormItem top="Телефон для клиентского профиля">
                {renderPhoneInput()}
              </FormItem>
            ) : null}
            {authDiscovery?.phoneMissingForClient && authDiscovery?.clientProfileExists === false
              ? renderPersonalDataConsent()
              : null}
            {authError ? <AuthNotice title="Не получилось войти" tone="error">{authError}</AuthNotice> : null}
            <FormItem>
              <Button
                stretched
                size="l"
                onClick={handleContinueLogin}
                disabled={authDiscovery?.phoneMissingForClient && (!isValidPhone(devAuthForm.phone) || (authDiscovery?.clientProfileExists === false && !personalDataConsent))}
              >
                Открыть доступные разделы
              </Button>
            </FormItem>
          </>
        ) : null}

        {authDiscovery?.status === 'client_found' ? (
          <>
            <AuthNotice title={`Найден клиент: ${devAuthForm.fullName || 'Пользователь'}`}>
              Можно открыть клиентский кабинет.
            </AuthNotice>
            {authDiscovery?.phoneMissing ? (
              <FormItem top="Телефон">
                {renderPhoneInput()}
              </FormItem>
            ) : null}
            {authError ? <AuthNotice title="Не получилось войти" tone="error">{authError}</AuthNotice> : null}
            <FormItem>
              <Button stretched size="l" onClick={handleContinueLogin} disabled={authDiscovery?.phoneMissing && !isValidPhone(devAuthForm.phone)}>
                {authDiscovery?.phoneMissing ? 'Сохранить телефон и продолжить' : 'Открыть клиентский раздел'}
              </Button>
            </FormItem>
          </>
        ) : null}

        {authDiscovery?.status === 'needs_registration' ? (
          <>
            <AuthNotice title="Новый пользователь" tone="accent">
              Завершите регистрацию клиента: нужен только номер телефона.
            </AuthNotice>
            <FormItem top="Телефон">
              {renderPhoneInput()}
            </FormItem>
            {renderPersonalDataConsent()}
            {authError ? <AuthNotice title="Не получилось войти" tone="error">{authError}</AuthNotice> : null}
            <FormItem>
              <Button stretched size="l" onClick={handleContinueLogin} disabled={!isValidPhone(devAuthForm.phone) || !personalDataConsent}>
                Привязать и продолжить
              </Button>
            </FormItem>
          </>
        ) : null}
        </Group>
      </AuthScreen>
    );
  };

  const renderActivePanel = () => {
    switch (activePanel) {
      case DEFAULT_VIEW_PANELS.LOGIN:
        if (!authUser) {
          return (
            <Panel id="login" className="auth-panel">
              <PanelHeader>Вход</PanelHeader>
              {renderLoginPanel()}
            </Panel>
          );
        }
        return null;

      case DEFAULT_VIEW_PANELS.ROLE_MENU:
        return (
          <Panel id={DEFAULT_VIEW_PANELS.ROLE_MENU} className="auth-panel">
            <PanelHeader>Главное меню</PanelHeader>
            <AuthScreen
              eyebrow="Выбор роли"
              title="Куда переходим?"
              subtitle="Откройте клиентский, рабочий или административный интерфейс в том же визуальном стиле салона."
            >
              <Group className="auth-group auth-role-group" header={<Header mode="secondary">Выберите раздел</Header>}>
                {authError ? <AuthNotice title="Не удалось открыть раздел" tone="error">{authError}</AuthNotice> : null}
                {availableRoles.includes('client') ? (
                  <RoleCard
                    role="client"
                    title="Клиент"
                    description="Записи, питомцы и профиль"
                    onClick={() => handleRoleSelect('client', CLIENT_PANELS.DASHBOARD)}
                  />
                ) : null}
                {availableRoles.includes('groomer') ? (
                  <RoleCard
                    role="groomer"
                    title="Грумер"
                    description="Заказы, смены и выполнение услуг"
                    onClick={() => handleRoleSelect('groomer', EMPLOYEE_PANELS.DASHBOARD)}
                  />
                ) : null}
                {availableRoles.includes('admin') ? (
                  <RoleCard
                    role="admin"
                    title="Администратор"
                    description="Расписание, сотрудники и управление"
                    onClick={() => handleRoleSelect('admin', ADMIN_PANELS.DASHBOARD)}
                  />
                ) : null}
              </Group>
            </AuthScreen>
          </Panel>
        );

      case ADMIN_PANELS.DASHBOARD:
        return authUser ? <AdminDashboard id={ADMIN_PANELS.DASHBOARD} /> : null;
      case EMPLOYEE_PANELS.DASHBOARD:
        return authUser ? <EmployeeDashboard id={EMPLOYEE_PANELS.DASHBOARD} /> : null;
      case CLIENT_PANELS.DASHBOARD:
        return authUser ? <ClientDashboard id={CLIENT_PANELS.DASHBOARD} /> : null;
      default:
        return <Home id={activePanel} fetchedUser={fetchedUser} />;
    }
  };

  return (
    <SplitLayout>
      <SplitCol animate={false}>
        <View key={activePanel} activePanel={activePanel}>
          {renderActivePanel()}
        </View>
      </SplitCol>
      {popout}
    </SplitLayout>
  );
};
