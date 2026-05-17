import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { View, SplitLayout, SplitCol, Button, Group, Header, Panel, PanelHeader, FormItem, Input } from '@vkontakte/vkui';
import { useActiveVkuiLocation, useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import { useAuth } from './contexts/AuthContext';
import { authApi } from './api/endpoints';
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
  const [manualLogout, setManualLogout] = useState(() => sessionStorage.getItem('grooming:manualLogout') === '1');

  const resetAuthScreen = React.useCallback(() => {
    setAvailableRoles([]);
    setRolesResolved(false);
    setDevAuthForm(EMPTY_AUTH_FORM);
    setNeedsRegistration(false);
    setAuthError('');
    setAuthDiscovery(null);
    setAuthChecking(false);
  }, []);

  useEffect(() => {
    if (!authUser && activePanel !== DEFAULT_VIEW_PANELS.LOGIN) {
      routeNavigator.push('/login');
    }
  }, [authUser, activePanel, routeNavigator]);

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

  const handleDevLogin = async () => {
    try {
      setAuthError('');
      const discovery = await authApi.discover({
        vkId: Number(devAuthForm.vkId),
        fullName: devAuthForm.fullName,
      });

      setAuthDiscovery(discovery);
      setNeedsRegistration(discovery?.status === 'needs_registration');
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
        fullName: discovery?.fullName || devAuthForm.fullName,
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
      const loginResult = await login({
        vkId: Number(devAuthForm.vkId),
        fullName: devAuthForm.fullName,
        phone: shouldSendPhone ? devAuthForm.phone : undefined,
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
                    <Input
                      value={devAuthForm.phone}
                      onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="Заполните номер телефона"
                    />
                  </FormItem>
                ) : null}
              <FormItem>
                <Button
                  stretched
                  size="l"
                  onClick={handleContinueLogin}
                  disabled={authDiscovery?.phoneMissingForClient && !devAuthForm.phone}
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
                  <Input
                    value={devAuthForm.phone}
                    onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Заполните номер телефона"
                  />
                </FormItem>
              ) : null}
              <FormItem>
                <Button
                  stretched
                  size="l"
                  onClick={handleContinueLogin}
                  disabled={(authDiscovery?.phoneMissing || authDiscovery?.phoneMissingForClient) && !devAuthForm.phone}
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
                <Input
                  value={devAuthForm.phone}
                  onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Заполните номер телефона"
                />
              </FormItem>
              <FormItem>
                <Button stretched size="l" onClick={handleContinueLogin} disabled={!devAuthForm.phone}>
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
                onChange={(e) => setDevAuthForm((prev) => ({ ...prev, vkId: e.target.value.replace(/\D/g, '') }))}
              />
            </FormItem>
            <FormItem top="Имя и фамилия">
              <Input
                value={devAuthForm.fullName}
                readOnly={authDiscovery?.status === 'employee_found'}
                onChange={(e) => setDevAuthForm((prev) => ({ ...prev, fullName: e.target.value }))}
              />
            </FormItem>
            {authError ? <AuthNotice title="Не получилось войти" tone="error">{authError}</AuthNotice> : null}
            <FormItem>
              <Button stretched size="l" onClick={handleDevLogin} disabled={!devAuthForm.vkId || !devAuthForm.fullName}>
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
                <Input
                  value={devAuthForm.phone}
                  onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Заполните номер телефона"
                />
              </FormItem>
            ) : null}
            {authError ? <AuthNotice title="Не получилось войти" tone="error">{authError}</AuthNotice> : null}
            <FormItem>
              <Button
                stretched
                size="l"
                onClick={handleContinueLogin}
                disabled={authDiscovery?.phoneMissingForClient && !devAuthForm.phone}
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
                <Input
                  value={devAuthForm.phone}
                  onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Заполните номер телефона"
                />
              </FormItem>
            ) : null}
            {authError ? <AuthNotice title="Не получилось войти" tone="error">{authError}</AuthNotice> : null}
            <FormItem>
              <Button stretched size="l" onClick={handleContinueLogin} disabled={authDiscovery?.phoneMissing && !devAuthForm.phone}>
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
              <Input
                value={devAuthForm.phone}
                onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Заполните номер телефона"
              />
            </FormItem>
            {authError ? <AuthNotice title="Не получилось войти" tone="error">{authError}</AuthNotice> : null}
            <FormItem>
              <Button stretched size="l" onClick={handleContinueLogin} disabled={!devAuthForm.phone}>
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
