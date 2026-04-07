import React, { useState, useEffect } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { View, SplitLayout, SplitCol, Button, Group, SimpleCell, Header, Panel, PanelHeader, FormItem, Input } from '@vkontakte/vkui';
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

export const App = () => {
  const { panel: activePanel } = useActiveVkuiLocation();
  const [fetchedUser, setUser] = useState();
  const [popout, setPopout] = useState(null);
  const { login, user: authUser, switchRole } = useAuth();
  const routeNavigator = useRouteNavigator();
  const [availableRoles, setAvailableRoles] = useState([]);
  const [rolesResolved, setRolesResolved] = useState(false);
  const [devAuthForm, setDevAuthForm] = useState({
    vkId: '195197738',
    fullName: 'Тестовый пользователь',
    phone: '+79990000000',
  });
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authDiscovery, setAuthDiscovery] = useState(null);
  const [authChecking, setAuthChecking] = useState(false);

  useEffect(() => {
    if (!authUser && activePanel !== DEFAULT_VIEW_PANELS.LOGIN) {
      routeNavigator.push('/login');
    }
  }, [authUser, activePanel, routeNavigator]);

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
  }, [authUser, login]);

  const handleDevLogin = async () => {
    try {
      setAuthError('');
      const discovery = await authApi.discover({
        vkId: Number(devAuthForm.vkId),
        fullName: devAuthForm.fullName,
      });

      setAuthDiscovery(discovery);
      setNeedsRegistration(discovery?.status === 'needs_registration');
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

  const renderLoginPanel = () => {
    if (bridge.isWebView()) {
      return (
        <Group className="auth-group" header={<Header mode="secondary">Авторизация</Header>}>
          {authChecking ? <SimpleCell>Проверяем ваш профиль и доступные роли...</SimpleCell> : null}

          {!authChecking && authDiscovery?.status === 'employee_found' ? (
            <>
              <SimpleCell>
                Найден сотрудник: {devAuthForm.fullName || 'Пользователь'}
              </SimpleCell>
              <SimpleCell>
                Доступные роли: {(authDiscovery.availableRoles || []).map((role) => ROLE_LABELS[role] || role).join(', ')}
              </SimpleCell>
              <FormItem>
                <Button stretched size="l" onClick={handleContinueLogin}>
                  Открыть доступные разделы
                </Button>
              </FormItem>
            </>
          ) : null}

          {!authChecking && authDiscovery?.status === 'client_found' ? (
            <>
              <SimpleCell>
                Найден клиент: {devAuthForm.fullName || 'Пользователь'}
              </SimpleCell>
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

          {!authChecking && authDiscovery?.status === 'needs_registration' ? (
            <>
              <SimpleCell>
                Профиль VK найден. Нужно завершить регистрацию клиента.
              </SimpleCell>
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

          {authError ? <SimpleCell>{authError}</SimpleCell> : null}
        </Group>
      );
    }

    return (
      <Group className="auth-group" header={<Header mode="secondary">Режим разработки</Header>}>
        <SimpleCell>Для VK Mini App `VK ID` и ФИО будут получены автоматически из профиля VK.</SimpleCell>

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
            {authError ? <SimpleCell>{authError}</SimpleCell> : null}
            <FormItem>
              <Button stretched size="l" onClick={handleDevLogin} disabled={!devAuthForm.vkId || !devAuthForm.fullName}>
                Продолжить
              </Button>
            </FormItem>
          </>
        ) : null}

        {authDiscovery?.status === 'employee_found' ? (
          <>
            <SimpleCell>
              Найден сотрудник: {devAuthForm.fullName || 'Пользователь'}
            </SimpleCell>
            <SimpleCell>
              Доступные роли: {(authDiscovery.availableRoles || []).map((role) => ROLE_LABELS[role] || role).join(', ')}
            </SimpleCell>
            {authDiscovery?.phoneMissingForClient ? (
              <FormItem top="Телефон для клиентского профиля">
                <Input
                  value={devAuthForm.phone}
                  onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Заполните номер телефона"
                />
              </FormItem>
            ) : null}
            {authError ? <SimpleCell>{authError}</SimpleCell> : null}
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
            <SimpleCell>
              Найден клиент: {devAuthForm.fullName || 'Пользователь'}
            </SimpleCell>
            {authDiscovery?.phoneMissing ? (
              <FormItem top="Телефон">
                <Input
                  value={devAuthForm.phone}
                  onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Заполните номер телефона"
                />
              </FormItem>
            ) : null}
            {authError ? <SimpleCell>{authError}</SimpleCell> : null}
            <FormItem>
              <Button stretched size="l" onClick={handleContinueLogin} disabled={authDiscovery?.phoneMissing && !devAuthForm.phone}>
                {authDiscovery?.phoneMissing ? 'Сохранить телефон и продолжить' : 'Открыть клиентский раздел'}
              </Button>
            </FormItem>
          </>
        ) : null}

        {authDiscovery?.status === 'needs_registration' ? (
          <>
            <SimpleCell>
              Новый пользователь. Завершите регистрацию клиента.
            </SimpleCell>
            <FormItem top="Телефон">
              <Input
                value={devAuthForm.phone}
                onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Заполните номер телефона"
              />
            </FormItem>
            {authError ? <SimpleCell>{authError}</SimpleCell> : null}
            <FormItem>
              <Button stretched size="l" onClick={handleContinueLogin} disabled={!devAuthForm.phone}>
                Привязать и продолжить
              </Button>
            </FormItem>
          </>
        ) : null}
      </Group>
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
            <Group className="auth-group" header={<Header mode="secondary">Выберите раздел</Header>}>
              {availableRoles.includes('client') ? (
                <FormItem>
                  <Button
                    stretched
                    size="l"
                    onClick={async () => {
                      const result = await switchRole('client');
                      if (result.success) {
                        routeNavigator.push(`/${CLIENT_PANELS.DASHBOARD}`);
                      }
                    }}
                  >
                    Клиент
                  </Button>
                </FormItem>
              ) : null}
              {availableRoles.includes('groomer') ? (
                <FormItem>
                  <Button
                    stretched
                    size="l"
                    onClick={async () => {
                      const result = await switchRole('groomer');
                      if (result.success) {
                        routeNavigator.push(`/${EMPLOYEE_PANELS.DASHBOARD}`);
                      }
                    }}
                  >
                    Грумер
                  </Button>
                </FormItem>
              ) : null}
              {availableRoles.includes('admin') ? (
                <FormItem>
                  <Button
                    stretched
                    size="l"
                    onClick={async () => {
                      const result = await switchRole('admin');
                      if (result.success) {
                        routeNavigator.push(`/${ADMIN_PANELS.DASHBOARD}`);
                      }
                    }}
                  >
                    Администратор
                  </Button>
                </FormItem>
              ) : null}
            </Group>
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
      <SplitCol>
        <View activePanel={activePanel}>
          {renderActivePanel()}
        </View>
      </SplitCol>
      {popout}
    </SplitLayout>
  );
};
