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
  client: 'РљР»РёРµРЅС‚',
  groomer: 'Р“СЂСѓРјРµСЂ',
  admin: 'РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ',
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
    fullName: 'РўРµСЃС‚РѕРІС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ',
    phone: '+79990000000',
  });
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authDiscovery, setAuthDiscovery] = useState(null);
  const [authChecking, setAuthChecking] = useState(false);

  // Debug: Log activePanel changes
  useEffect(() => {
    console.log('Active panel changed:', activePanel, 'Auth user:', authUser);
  }, [activePanel, authUser]);

  // Redirect unauthenticated users to login panel
  useEffect(() => {
    console.log('Auth check: authUser=', authUser, 'activePanel=', activePanel);
    
    // If user is not authenticated and not on login panel, redirect to login
    if (!authUser && activePanel !== 'login') {
      console.log('Redirecting unauthenticated user to login panel');
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
        if (Array.isArray(data?.roles)) {
          setAvailableRoles(data.roles);
        } else {
          setAvailableRoles([authUser.role]);
        }
      } catch (error) {
        setAvailableRoles([authUser.role]);
      } finally {
        setRolesResolved(true);
      }
    };

    loadRoles();
  }, [authUser]);

  // Redirect authenticated users away from login/home to their role dashboard
  // This handles both login -> dashboard and restored user -> dashboard
  useEffect(() => {
    if (!authUser || !rolesResolved) {
      return;
    }

    if (activePanel === 'login' || activePanel === 'home') {
      console.log('Authenticated user on login/home panel, redirecting to dashboard');
      const target = availableRoles.length > 1
        ? DEFAULT_VIEW_PANELS.ROLE_MENU
        : getDashboardPanelByRole(authUser.role);
      // Small delay to ensure state is fully updated
      setTimeout(() => {
        routeNavigator.push(`/${target}`);
      }, 100);
    }
  }, [authUser, activePanel, routeNavigator, availableRoles, rolesResolved]);

  // Prevent users from opening panels of another role (manual URL / stale route in history)
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

  // Fetch VK user info and auto-login on initial load
  useEffect(() => {
    // In local browser development (outside VK WebView), do not block UI with global spinner.
    if (!bridge.isWebView()) {
      setPopout(null);
      return;
    }

    async function fetchData() {
      // Only fetch if not authenticated
      if (authUser) {
        setPopout(null);
        return;
      }
      
      try {
        console.log('Fetching VK user info...');
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
            setAuthError(loginResult.error || 'РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РІС…РѕРґ');
          }
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
        setAuthError('РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РїСЂРѕС„РёР»СЊ VK');
      } finally {
        setAuthChecking(false);
        setPopout(null);
      }
    }
    
    // Add a small delay to ensure authUser is properly initialized
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
        console.error('Login failed:', loginResult.error);
        setAuthError(loginResult.error || 'РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РІС…РѕРґ');
        return;
      }
      setNeedsRegistration(false);
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РІС…РѕРґ');
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
        setAuthError(loginResult.error || 'РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РІС…РѕРґ');
        return;
      }

      setNeedsRegistration(false);
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РІС…РѕРґ');
    }
  };

  // Render the appropriate panel based on the active panel ID
  const renderActivePanel = () => {
    // User is authenticated, show the active panel
    switch(activePanel) {
      case DEFAULT_VIEW_PANELS.LOGIN:
        // If user is not authenticated, show login panel
        if (!authUser) {
          return (
            <Panel id="login" className="auth-panel">
              <PanelHeader>Р’С…РѕРґ</PanelHeader>
              {bridge.isWebView() ? (
                <Group className="auth-group" header={<Header mode="secondary">РђРІС‚РѕСЂРёР·Р°С†РёСЏ</Header>}>
                  {authChecking ? <SimpleCell>РџСЂРѕРІРµСЂСЏРµРј РІР°С€ РїСЂРѕС„РёР»СЊ Рё РґРѕСЃС‚СѓРїС‹...</SimpleCell> : null}

                  {!authChecking && authDiscovery?.status === 'employee_found' ? (
                    <>
                      <SimpleCell>
                        РќР°Р№РґРµРЅ СЃРѕС‚СЂСѓРґРЅРёРє: {devAuthForm.fullName || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'}
                      </SimpleCell>
                      <SimpleCell>
                        Р”РѕСЃС‚СѓРїРЅС‹Рµ СЂРѕР»Рё: {(authDiscovery.availableRoles || []).map((role) => ROLE_LABELS[role] || role).join(', ')}
                      </SimpleCell>
                      <FormItem>
                        <Button stretched size="l" onClick={handleContinueLogin}>
                          РћС‚РєСЂС‹С‚СЊ РґРѕСЃС‚СѓРїРЅС‹Рµ СЂР°Р·РґРµР»С‹
                        </Button>
                      </FormItem>
                    </>
                  ) : null}

                  {!authChecking && authDiscovery?.status === 'client_found' ? (
                    <>
                      <SimpleCell>
                        РќР°Р№РґРµРЅ РєР»РёРµРЅС‚: {devAuthForm.fullName || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'}
                      </SimpleCell>
                      {authDiscovery?.phoneMissing || authDiscovery?.phoneMissingForClient ? (
                        <FormItem top="РўРµР»РµС„РѕРЅ">
                          <Input
                            value={devAuthForm.phone}
                            onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                            placeholder="Р—Р°РїРѕР»РЅРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°"
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
                          {(authDiscovery?.phoneMissing || authDiscovery?.phoneMissingForClient) ? 'РЎРѕС…СЂР°РЅРёС‚СЊ С‚РµР»РµС„РѕРЅ Рё РїСЂРѕРґРѕР»Р¶РёС‚СЊ' : 'РћС‚РєСЂС‹С‚СЊ РєР»РёРµРЅС‚СЃРєРёР№ СЂР°Р·РґРµР»'}
                        </Button>
                      </FormItem>
                    </>
                  ) : null}

                  {!authChecking && authDiscovery?.status === 'needs_registration' ? (
                    <>
                      <SimpleCell>
                        РџСЂРѕС„РёР»СЊ VK РЅР°Р№РґРµРЅ, РЅСѓР¶РЅРѕ Р·Р°РІРµСЂС€РёС‚СЊ СЂРµРіРёСЃС‚СЂР°С†РёСЋ РєР»РёРµРЅС‚Р°.
                      </SimpleCell>
                      <FormItem top="РРјСЏ Рё С„Р°РјРёР»РёСЏ">
                        <Input value={devAuthForm.fullName} readOnly />
                      </FormItem>
                      <FormItem top="РўРµР»РµС„РѕРЅ">
                        <Input
                          value={devAuthForm.phone}
                          onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="Р—Р°РїРѕР»РЅРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°"
                        />
                      </FormItem>
                      <FormItem>
                        <Button stretched size="l" onClick={handleContinueLogin} disabled={!devAuthForm.phone}>
                          РџСЂРёРІСЏР·Р°С‚СЊ Рё РїСЂРѕРґРѕР»Р¶РёС‚СЊ
                        </Button>
                      </FormItem>
                    </>
                  ) : null}

                  {authError ? <SimpleCell>{authError}</SimpleCell> : null}
                </Group>
              ) : (
                <Group className="auth-group" header={<Header mode="secondary">Р РµР¶РёРј СЂР°Р·СЂР°Р±РѕС‚РєРё</Header>}>
                  <SimpleCell>Р”Р»СЏ VK Mini App `VK ID` Рё Р¤РРћ Р±СѓРґСѓС‚ РїРѕР»СѓС‡РµРЅС‹ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РёР· РїСЂРѕС„РёР»СЏ VK.</SimpleCell>
                  {!authDiscovery ? (
                    <>
                      <FormItem top="РўРµСЃС‚РѕРІС‹Р№ VK ID">
                        <Input
                          value={devAuthForm.vkId}
                          onChange={(e) => setDevAuthForm((prev) => ({ ...prev, vkId: e.target.value.replace(/\D/g, '') }))}
                        />
                      </FormItem>
                      <FormItem top="РРјСЏ Рё С„Р°РјРёР»РёСЏ">
                        <Input
                          value={devAuthForm.fullName}
                          readOnly={authDiscovery?.status === 'employee_found'}
                          onChange={(e) => setDevAuthForm((prev) => ({ ...prev, fullName: e.target.value }))}
                        />
                      </FormItem>
                      {authError ? <SimpleCell>{authError}</SimpleCell> : null}
                      <FormItem>
                        <Button stretched size="l" onClick={handleDevLogin} disabled={!devAuthForm.vkId || !devAuthForm.fullName}>
                          РџСЂРѕРґРѕР»Р¶РёС‚СЊ
                        </Button>
                      </FormItem>
                    </>
                  ) : null}

                  {authDiscovery?.status === 'employee_found' ? (
                    <>
                      <SimpleCell>
                        РќР°Р№РґРµРЅ СЃРѕС‚СЂСѓРґРЅРёРє: {devAuthForm.fullName || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'}
                      </SimpleCell>
                      <SimpleCell>
                        Р”РѕСЃС‚СѓРїРЅС‹Рµ СЂРѕР»Рё: {(authDiscovery.availableRoles || []).map((role) => ROLE_LABELS[role] || role).join(', ')}
                      </SimpleCell>
                      {authDiscovery?.phoneMissingForClient ? (
                        <FormItem top="РўРµР»РµС„РѕРЅ РґР»СЏ РєР»РёРµРЅС‚СЃРєРѕРіРѕ РїСЂРѕС„РёР»СЏ">
                          <Input
                            value={devAuthForm.phone}
                            onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                            placeholder="Р—Р°РїРѕР»РЅРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°"
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
                          РћС‚РєСЂС‹С‚СЊ РґРѕСЃС‚СѓРїРЅС‹Рµ СЂР°Р·РґРµР»С‹
                        </Button>
                      </FormItem>
                    </>
                  ) : null}

                  {authDiscovery?.status === 'client_found' ? (
                    <>
                      <SimpleCell>
                        РќР°Р№РґРµРЅ РєР»РёРµРЅС‚: {devAuthForm.fullName || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'}
                      </SimpleCell>
                      {authDiscovery?.phoneMissing ? (
                        <FormItem top="РўРµР»РµС„РѕРЅ">
                          <Input
                            value={devAuthForm.phone}
                            onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                            placeholder="Р—Р°РїРѕР»РЅРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°"
                          />
                        </FormItem>
                      ) : null}
                      {authError ? <SimpleCell>{authError}</SimpleCell> : null}
                      <FormItem>
                        <Button stretched size="l" onClick={handleContinueLogin} disabled={authDiscovery?.phoneMissing && !devAuthForm.phone}>
                          {authDiscovery?.phoneMissing ? 'РЎРѕС…СЂР°РЅРёС‚СЊ С‚РµР»РµС„РѕРЅ Рё РїСЂРѕРґРѕР»Р¶РёС‚СЊ' : 'РћС‚РєСЂС‹С‚СЊ РєР»РёРµРЅС‚СЃРєРёР№ СЂР°Р·РґРµР»'}
                        </Button>
                      </FormItem>
                    </>
                  ) : null}

                  {authDiscovery?.status === 'needs_registration' ? (
                    <>
                      <SimpleCell>
                        РќРѕРІС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ. Р—Р°РІРµСЂС€РёС‚Рµ СЂРµРіРёСЃС‚СЂР°С†РёСЋ РєР»РёРµРЅС‚Р°.
                      </SimpleCell>
                      <FormItem top="РўРµР»РµС„РѕРЅ">
                        <Input
                          value={devAuthForm.phone}
                          onChange={(e) => setDevAuthForm((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="Р—Р°РїРѕР»РЅРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°"
                        />
                      </FormItem>
                      {authError ? <SimpleCell>{authError}</SimpleCell> : null}
                      <FormItem>
                        <Button stretched size="l" onClick={handleContinueLogin} disabled={!devAuthForm.phone}>
                          РџСЂРёРІСЏР·Р°С‚СЊ Рё РїСЂРѕРґРѕР»Р¶РёС‚СЊ
                        </Button>
                      </FormItem>
                    </>
                  ) : null}
                </Group>
              )}
            </Panel>
          );
        }
        // Authenticated user on login panel - should be redirected by useEffect
        // Return null to prevent rendering while redirecting
        return null;
      case DEFAULT_VIEW_PANELS.ROLE_MENU:
        return (
          <Panel id={DEFAULT_VIEW_PANELS.ROLE_MENU} className="auth-panel">
            <PanelHeader>Р“Р»Р°РІРЅРѕРµ РјРµРЅСЋ</PanelHeader>
            <Group className="auth-group" header={<Header mode="secondary">Р’С‹Р±РµСЂРёС‚Рµ СЂР°Р·РґРµР»</Header>}>
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
                    РљР»РёРµРЅС‚
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
                    Р“СЂСѓРјРµСЂ
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
                    РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ
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

