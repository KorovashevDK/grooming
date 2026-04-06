import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import { ModalPage, ModalPageHeader, Group, SimpleCell, Button } from '@vkontakte/vkui';

const ProtectedRoute = ({ children, allowedRoles, fallbackComponent = null }) => {
  const { user, isAuthenticated } = useAuth();
  const routeNavigator = useRouteNavigator();

  if (!isAuthenticated) {
    // User not authenticated, redirect to home
    setTimeout(() => routeNavigator.push('/'), 0);
    return null;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    // User doesn't have required role
    if (fallbackComponent) {
      return fallbackComponent;
    }
    
    // Default forbidden component
    return (
      <ModalPage 
        id="forbidden"
        header={<ModalPageHeader>Доступ запрещен</ModalPageHeader>}
      >
        <Group>
          <SimpleCell>У вас нет доступа к этой странице</SimpleCell>
          <Button 
            size="l" 
            stretched 
            onClick={() => routeNavigator.push('/')}
          >
            Вернуться на главную
          </Button>
        </Group>
      </ModalPage>
    );
  }

  // User has required role, render the protected content
  return children;
};

export default ProtectedRoute;