import { Panel, PanelHeader, Group, Header, Card, CardGrid, SimpleCell, Avatar, Button, Badge, FormItem, Input, NativeSelect, Tabs, TabsItem } from '@vkontakte/vkui';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import PropTypes from 'prop-types';
import { employeeApi } from '../api/endpoints';
import './EmployeeDashboard.css';

const SIZE_LABELS = {
  small: 'Маленький',
  medium: 'Средний',
  large: 'Большой',
};

const ROLE_RATE_BY_ID = {
  '5EEFB7DC-57E8-404B-94D0-B641D7F6D696': 0.45,
  '882CB015-95ED-4C8E-B918-6E7C82606801': 0.35,
  'A0261582-900D-42C5-9C4B-6D6F60C23A36': 0.25,
};

const GROOMER_ROLE_IDS = [
  '5EEFB7DC-57E8-404B-94D0-B641D7F6D696',
  '882CB015-95ED-4C8E-B918-6E7C82606801',
  'A0261582-900D-42C5-9C4B-6D6F60C23A36',
];

const HOURLY_RATE_BY_ROLE_ID = {
  '88FCD70F-3EA6-400D-B233-647C30C4EA7E': 350,
  'DD19D48D-A2C4-4E3C-A762-EB125B31BB19': 350,
  'CAEBA1F4-A104-4C06-A398-20BECA42B0B0': 250,
};

const getStatusMeta = (status) => {
  if (status === 'completed' || status === 'Выполнено' || status === 'Выполнена' || status === 'Выполнен') {
    return { mode: 'positive', label: 'Выполнен' };
  }
  if (status === 'in_progress' || status === 'В процессе') {
    return { mode: 'warning', label: 'В процессе' };
  }
  if (status === 'Назначена' || status === 'Назначен') {
    return { mode: 'accent', label: 'Назначена' };
  }
  return { mode: 'default', label: 'Ожидает' };
};

const isCompletedOrderStatus = (status) => /completed|выполн/i.test(String(status || ''));
const isCancelledOrderStatus = (status) => /отмен/i.test(String(status || ''));

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toTimeMinutes = (value) => {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const formatDateTime = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleString('ru-RU') : 'Не указано';
};

const formatDurationLabel = (minutes) => {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) {
    return 'Нет записей';
  }

  const hours = Math.floor(total / 60);
  const restMinutes = total % 60;
  if (hours > 0 && restMinutes > 0) {
    return `${hours} ч ${restMinutes} мин`;
  }
  if (hours > 0) {
    return `${hours} ч`;
  }
  return `${restMinutes} мин`;
};

const getRoleRate = (roleId) => ROLE_RATE_BY_ID[roleId] || 0;
const getHourlyRate = (roleId) => HOURLY_RATE_BY_ROLE_ID[roleId] || 0;

const formatMoney = (value) => (
  Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} ₽` : '0.00 ₽'
);

const parseBookingDetails = (value) => {
  const source = String(value || '').trim();
  const result = {
    lastVisit: '',
    clientComment: '',
    masterComment: '',
  };

  if (!source) {
    return result;
  }

  source
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((part) => {
      if (part.startsWith('Последний визит:')) {
        result.lastVisit = part.replace(/^Последний визит:\s*/i, '');
      } else if (part.startsWith('Комментарий клиента:')) {
        result.clientComment = part.replace(/^Комментарий клиента:\s*/i, '');
      } else if (part.startsWith('Комментарий мастера:')) {
        result.masterComment = part.replace(/^Комментарий мастера:\s*/i, '');
      }
    });

  return result;
};

export const EmployeeDashboard = ({ id }) => {
  const scheduleFormRef = useRef(null);
  const { user, logout } = useAuth();
  const routeNavigator = useRouteNavigator();
  const [orders, setOrders] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('orders');
  const [visibleUpcomingShifts, setVisibleUpcomingShifts] = useState(4);
  const [visiblePastShifts, setVisiblePastShifts] = useState(3);
  const [completingOrderId, setCompletingOrderId] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [scheduleForm, setScheduleForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    roleId: '',
  });

  const loadDashboardData = async () => {
    const [ordersData, scheduleData] = await Promise.all([
      employeeApi.getDashboard(),
      employeeApi.getSchedule(),
    ]);
    setOrders(ordersData.assignedOrders || []);
    setSchedule(scheduleData.schedule || []);
  };

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        await loadDashboardData();
      } catch (error) {
        console.error('Error fetching employee orders:', error);
        setErrorMessage('Не удалось загрузить данные кабинета');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const updateOrderStatus = async (orderId, payload) => {
    try {
      setErrorMessage('');
      await employeeApi.updateOrderStatus(orderId, payload);
      await loadDashboardData();
      setCompletingOrderId('');
      setCompletionNote('');
    } catch (error) {
      console.error('Error updating order status:', error);
      setErrorMessage('Не удалось изменить статус заказа');
    }
  };

  const roleOptions = useMemo(() => {
    const groomerRoles = [
      { id: '882CB015-95ED-4C8E-B918-6E7C82606801', label: 'Грумер' },
      { id: '5EEFB7DC-57E8-404B-94D0-B641D7F6D696', label: 'Старший грумер' },
      { id: 'A0261582-900D-42C5-9C4B-6D6F60C23A36', label: 'Помощник грумера' },
    ];
    const adminRoles = [
      { id: '88FCD70F-3EA6-400D-B233-647C30C4EA7E', label: 'Администратор' },
      { id: 'DD19D48D-A2C4-4E3C-A762-EB125B31BB19', label: 'Управляющий' },
    ];
    return user?.role === 'admin' ? [...groomerRoles, ...adminRoles] : groomerRoles;
  }, [user]);

  const groupedOrders = useMemo(() => {
    const map = new Map();

    for (const order of orders) {
      const orderId = order.orderId || order['Код_заказа'];
      if (!orderId) {
        continue;
      }

      if (!map.has(orderId)) {
        map.set(orderId, {
          ...order,
          services: [],
          servicePrice: 0,
          duration: 0,
          startTime: null,
          endTime: null,
        });
      }

      const entry = map.get(orderId);
      if (order.serviceName) {
        entry.services.push(order.serviceName);
      }
      entry.servicePrice += Number(order.servicePrice) || 0;
      if (!entry.serviceStatus && order.serviceStatus) {
        entry.serviceStatus = order.serviceStatus;
      }
      entry.duration += Number(order.duration) || 0;
      const rowStart = toDate(order.startTime);
      const rowEnd = toDate(order.endTime);
      const currentStart = toDate(entry.startTime);
      const currentEnd = toDate(entry.endTime);

      if (rowStart && (!currentStart || rowStart.getTime() < currentStart.getTime())) {
        entry.startTime = order.startTime;
      }
      if (rowEnd && (!currentEnd || rowEnd.getTime() > currentEnd.getTime())) {
        entry.endTime = order.endTime;
      }
      if (!entry.note && order.note) {
        entry.note = order.note;
      }
    }

    return Array.from(map.values()).map((entry) => {
      const start = toDate(entry.startTime);
      const end = toDate(entry.endTime);
      if (start && end) {
        const actualDuration = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
        return {
          ...entry,
          details: parseBookingDetails(entry.note),
          duration: actualDuration,
        };
      }
      return {
        ...entry,
        details: parseBookingDetails(entry.note),
      };
    }).sort((a, b) => {
      const aTime = toDate(a.startTime)?.getTime() || 0;
      const bTime = toDate(b.startTime)?.getTime() || 0;
      return aTime - bTime;
    });
  }, [orders]);

  const pendingOrders = useMemo(
    () => groupedOrders.filter((order) => !/completed|выполн/i.test(String(order.serviceStatus || order['Статус'] || ''))),
    [groupedOrders],
  );

  const completedOrders = useMemo(
    () => groupedOrders.filter((order) => /completed|выполн/i.test(String(order.serviceStatus || order['Статус'] || ''))),
    [groupedOrders],
  );

  const scheduleSummary = useMemo(() => {
    const now = new Date();

    const items = schedule.map((entry) => {
      const isGroomerShift = GROOMER_ROLE_IDS.includes(entry.roleId);
      const scheduleDate = entry.scheduleDate ? String(entry.scheduleDate).split('T')[0] : null;
      const startMinutes = toTimeMinutes(entry.scheduleStart);
      const endMinutes = toTimeMinutes(entry.scheduleEnd);
      const shiftHours = startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
        ? (endMinutes - startMinutes) / 60
        : 0;

      const bookings = (isGroomerShift ? groupedOrders : [])
        .filter((order) => {
          const orderStart = toDate(order.startTime);
          const orderEnd = toDate(order.endTime);
          if (!orderStart || !orderEnd || !scheduleDate) {
            return false;
          }

          const orderDate = orderStart.toISOString().slice(0, 10);
          const orderStartMinutes = orderStart.getHours() * 60 + orderStart.getMinutes();
          const orderEndMinutes = orderEnd.getHours() * 60 + orderEnd.getMinutes();

          return (
            orderDate === scheduleDate &&
            startMinutes !== null &&
            endMinutes !== null &&
            orderStartMinutes >= startMinutes &&
            orderEndMinutes <= endMinutes
          );
        })
        .sort((a, b) => {
          const aTime = toDate(a.startTime)?.getTime() || 0;
          const bTime = toDate(b.startTime)?.getTime() || 0;
          return aTime - bTime;
        });
      const completedBookings = bookings.filter((booking) => isCompletedOrderStatus(booking.serviceStatus || booking['Статус']));

      const shiftStartDateTime = scheduleDate && entry.scheduleStart
        ? new Date(`${scheduleDate}T${entry.scheduleStart}:00`)
        : null;
      const shiftEndDateTime = scheduleDate && entry.scheduleEnd
        ? new Date(`${scheduleDate}T${entry.scheduleEnd}:00`)
        : null;
      const actualDurationMinutes = completedBookings.reduce((sum, booking) => {
        const bookingStart = toDate(booking.startTime);
        const bookingEnd = toDate(booking.endTime);
        if (!bookingStart || !bookingEnd) {
          return sum;
        }
        const diff = Math.max(0, Math.round((bookingEnd.getTime() - bookingStart.getTime()) / 60000));
        return sum + diff;
      }, 0);

      return {
        ...entry,
        dateLabel: entry.scheduleDate ? new Date(entry.scheduleDate).toLocaleDateString('ru-RU') : 'Дата не указана',
        timeLabel: `${entry.scheduleStart || '--:--'}–${entry.scheduleEnd || '--:--'}`,
        actualTimeLabel: formatDurationLabel(actualDurationMinutes),
        bookings,
        completedBookings,
        bookingsCount: bookings.length,
        shiftRevenue: completedBookings.reduce((sum, item) => sum + (Number(item.servicePrice) || 0), 0),
        completedRevenue: completedBookings.reduce((sum, item) => sum + (Number(item.servicePrice) || 0), 0),
        pendingRevenue: bookings.reduce((sum, item) => {
          if (isCancelledOrderStatus(item.serviceStatus || item['Статус']) || isCompletedOrderStatus(item.serviceStatus || item['Статус'])) {
            return sum;
          }
          return sum + (Number(item.servicePrice) || 0);
        }, 0),
        salaryRate: getRoleRate(entry.roleId),
        hourlyRate: getHourlyRate(entry.roleId),
        shiftHours,
        isGroomerShift,
        isPast: shiftEndDateTime ? shiftEndDateTime.getTime() < now.getTime() : false,
        sortTime: shiftStartDateTime ? shiftStartDateTime.getTime() : 0,
      };
    });

    items.forEach((item) => {
      const hourlySalary = item.shiftHours * item.hourlyRate;
      item.shiftSalary = item.isGroomerShift
        ? (item.completedRevenue + item.pendingRevenue) * item.salaryRate
        : hourlySalary;
      item.payoutSalary = item.isGroomerShift ? item.completedRevenue * item.salaryRate : (item.isPast ? hourlySalary : 0);
      item.expectedSalary = item.isGroomerShift
        ? item.pendingRevenue * item.salaryRate
        : Math.max(item.shiftSalary - item.payoutSalary, 0);
    });

    const upcoming = items
      .filter((item) => !item.isPast)
      .sort((a, b) => a.sortTime - b.sortTime);

    const past = items
      .filter((item) => item.isPast)
      .sort((a, b) => b.sortTime - a.sortTime);

    return { upcoming, past };
  }, [schedule, groupedOrders]);

  const monthlyStats = useMemo(() => {
    const monthMap = new Map();
    const allShifts = [...scheduleSummary.upcoming, ...scheduleSummary.past];

    for (const shift of allShifts) {
      const date = shift.scheduleDate ? new Date(shift.scheduleDate) : null;
      if (!date || Number.isNaN(date.getTime())) {
        continue;
      }

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          key,
          label: date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
          revenue: 0,
          salary: 0,
          shifts: 0,
          bookings: 0,
          workedShifts: 0,
          plannedShifts: 0,
          payoutSalary: 0,
          expectedSalary: 0,
        });
      }

      const item = monthMap.get(key);
      item.revenue += shift.shiftRevenue;
      item.salary += shift.shiftSalary;
      item.shifts += 1;
      item.bookings += shift.bookingsCount;
      if (shift.payoutSalary > 0) {
        item.workedShifts += 1;
        item.payoutSalary += shift.payoutSalary;
      }
      if (shift.expectedSalary > 0) {
        item.plannedShifts += 1;
        item.expectedSalary += shift.expectedSalary;
      }
    }

    return Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [scheduleSummary]);

  const currentMonthSummary = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonth = monthlyStats.find((item) => item.key === currentKey);

    return {
      monthSalary: currentMonth?.salary || 0,
      payoutNow: currentMonth?.payoutSalary || 0,
      expected: currentMonth?.expectedSalary || 0,
      upcomingShifts: scheduleSummary.upcoming.length,
    };
  }, [monthlyStats, scheduleSummary]);

  const resetScheduleForm = () => {
    setScheduleForm({ date: '', startTime: '', endTime: '', roleId: '' });
    setEditingScheduleId('');
  };

  const handleSaveSchedule = async () => {
    if (!scheduleForm.date || !scheduleForm.startTime || !scheduleForm.endTime) return;
    if (scheduleForm.startTime >= scheduleForm.endTime) {
      setErrorMessage('Время окончания должно быть позже времени начала');
      return;
    }

    setSavingSchedule(true);
    try {
      setErrorMessage('');
      if (editingScheduleId) {
        await employeeApi.updateSchedule(editingScheduleId, scheduleForm);
      } else {
        await employeeApi.createSchedule(scheduleForm);
      }
      await loadDashboardData();
      resetScheduleForm();
    } catch (error) {
      console.error('Error saving schedule:', error);
      setErrorMessage(error?.data?.details || 'Не удалось сохранить смену');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleEditSchedule = (entry) => {
    if (!entry?.isGroomerShift) {
      return;
    }
    setEditingScheduleId(entry.scheduleId);
    setScheduleForm({
      date: entry.scheduleDate ? entry.scheduleDate.split('T')[0] : '',
      startTime: entry.scheduleStart || '',
      endTime: entry.scheduleEnd || '',
      roleId: entry.roleId || '',
    });
    window.requestAnimationFrame(() => {
      scheduleFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      setErrorMessage('');
      await employeeApi.deleteSchedule(scheduleId);
      await loadDashboardData();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setErrorMessage(error?.data?.details || 'Не удалось удалить смену');
    }
  };

  useEffect(() => {
    setVisibleUpcomingShifts(4);
    setVisiblePastShifts(3);
  }, [activeTab]);

  return (
    <Panel id={id} className="employee-dashboard">
      <PanelHeader
        after={(
          <div className="ed-header-actions">
            <Button mode="secondary" size="s" onClick={() => routeNavigator.push('/role-menu')}>
              Выбор роли
            </Button>
            <Button mode="tertiary" size="s" onClick={logout}>
              Выйти
            </Button>
          </div>
        )}
      >
        Пёс Пижон · Кабинет грумера
      </PanelHeader>

      {loading ? (
        <div className="ed-loading">
          <div className="ed-spinner" />
        </div>
      ) : (
        <div className="ed-page">
          <div className="ed-toolbar">
            <Button mode="secondary" size="m" onClick={() => routeNavigator.push('/role-menu')}>
              Выбор роли
            </Button>
            <Button mode="tertiary" size="m" onClick={logout}>
              Выйти
            </Button>
          </div>

          <section className="ed-hero">
            <div>
              <div className="ed-hero-kicker">Пёс Пижон</div>
              <div className="ed-hero-title">Рабочая панель грумера</div>
              <div className="ed-hero-subtitle">Управляйте записями и своим расписанием без лишнего шума.</div>
            </div>
            <div className="ed-hero-stats">
              <div className="ed-stat">
                <div className="ed-stat-label">Записей</div>
                <div className="ed-stat-value">{groupedOrders.length}</div>
              </div>
              <div className="ed-stat">
                <div className="ed-stat-label">Активные</div>
                <div className="ed-stat-value">
                  {groupedOrders.filter((order) => !/completed|выполн/i.test(String(order.serviceStatus || order['Статус'] || ''))).length}
                </div>
              </div>
              <div className="ed-stat">
                <div className="ed-stat-label">Всего смен</div>
                <div className="ed-stat-value">{schedule.length}</div>
              </div>
            </div>
          </section>

          <section className="ed-summary-grid">
            <div className="ed-summary-card">
              <div className="ed-summary-label">Зарплата за текущий месяц</div>
              <div className="ed-summary-value">{formatMoney(currentMonthSummary.monthSalary)}</div>
            </div>
            <div className="ed-summary-card">
              <div className="ed-summary-label">К выплате сейчас</div>
              <div className="ed-summary-value">{formatMoney(currentMonthSummary.payoutNow)}</div>
            </div>
            <div className="ed-summary-card">
              <div className="ed-summary-label">Ожидается</div>
              <div className="ed-summary-value">{formatMoney(currentMonthSummary.expected)}</div>
            </div>
            <div className="ed-summary-card">
              <div className="ed-summary-label">Ближайшие смены</div>
              <div className="ed-summary-value">{currentMonthSummary.upcomingShifts}</div>
            </div>
          </section>

          {errorMessage ? <div className="ed-empty">{errorMessage}</div> : null}

          <Group className="ed-group" header={<Header mode="secondary">Управление</Header>}>
            <Tabs className="ed-tabs">
              <TabsItem selected={activeTab === 'orders'} onClick={() => setActiveTab('orders')}>
                Записи
              </TabsItem>
              <TabsItem selected={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')}>
                Расписание
              </TabsItem>
              <TabsItem selected={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>
                Статистика
              </TabsItem>
            </Tabs>
          </Group>

          {activeTab === 'orders' ? (
          <Group className="ed-group" header={<Header mode="secondary">Мои записи</Header>}>
            {pendingOrders.length > 0 ? (
              <>
                <div className="ed-section-title">Требуют подтверждения выполнения</div>
                {pendingOrders.map((order) => {
                const status = getStatusMeta(order.serviceStatus || order['Статус']);
                const orderDate = order.orderDate
                  ? new Date(order.orderDate).toLocaleString('ru-RU')
                  : 'Дата не указана';
                const startLabel = order.startTime
                  ? new Date(order.startTime).toLocaleString('ru-RU')
                  : 'Не указано';
                const endLabel = order.endTime
                  ? new Date(order.endTime).toLocaleString('ru-RU')
                  : 'Не указано';
                const servicesLabel = order.services.length > 0
                  ? order.services.join(', ')
                  : (order.serviceName || 'Не указана');
                const petLabel = [
                  order.petName || 'Питомец',
                  order.petBreed ? `(${order.petBreed})` : '',
                  order.petKind || '',
                ].filter(Boolean).join(' ');

                return (
                  <CardGrid key={order.orderId} size="l">
                    <Card mode="shadow" className="ed-card ed-orders-card">
                      <SimpleCell
                        before={<Avatar size={48} initials={order.clientName?.charAt(0) || 'К'} />}
                        after={<Badge mode={status.mode}>{status.label}</Badge>}
                        description={`Клиент: ${order.clientName || 'Клиент'} · ${petLabel}`}
                      >
                        {servicesLabel}
                      </SimpleCell>
                      <div className="ed-order-details">
                        <div className="ed-detail-row"><strong>Дата оформления:</strong> {orderDate}</div>
                        <div className="ed-detail-row"><strong>Начало:</strong> {startLabel}</div>
                        <div className="ed-detail-row"><strong>Окончание:</strong> {endLabel}</div>
                        <div className="ed-detail-row"><strong>Статус заказа:</strong> {status.label}</div>
                        <div className="ed-detail-row"><strong>Владелец:</strong> {order.clientName || 'Не указан'}</div>
                        <div className="ed-detail-row"><strong>Кличка питомца:</strong> {order.petName || 'Не указана'}</div>
                        <div className="ed-detail-row"><strong>Порода:</strong> {order.petBreed || 'Не указана'}</div>
                        <div className="ed-detail-row"><strong>Вид:</strong> {order.petKind || 'Не указан'}</div>
                        <div className="ed-detail-row"><strong>Длительность:</strong> {order.duration ? `${order.duration} мин` : 'Не указана'}</div>
                        <div className="ed-detail-row"><strong>Стоимость заказа:</strong> {order.orderTotal ? `${Number(order.orderTotal).toFixed(2)} ₽` : 'Не указана'}</div>
                        <div className="ed-detail-row"><strong>Размер питомца:</strong> {SIZE_LABELS[order.petSize] || order.petSize || 'Не указан'}</div>
                        <div className="ed-detail-row"><strong>Возраст питомца:</strong> {order.petAge ?? 'Не указан'}</div>
                        <div className="ed-detail-row"><strong>Последний визит:</strong> {order.details?.lastVisit || 'Не указан'}</div>
                        <div className="ed-detail-row"><strong>Комментарий клиента:</strong> {order.details?.clientComment || 'Нет'}</div>
                        <div className="ed-detail-row"><strong>Комментарий мастера:</strong> {order.details?.masterComment || 'Нет'}</div>
                      </div>

                      {!/completed|выполн/i.test(String(order.serviceStatus || '')) && (
                        <div className="ed-card-actions">
                          {completingOrderId === order.orderId ? (
                            <div className="ed-complete-box">
                              <FormItem top="Примечание грумера" className="ed-complete-note-item">
                                <Input
                                  value={completionNote}
                                  onChange={(e) => setCompletionNote(e.target.value)}
                                  placeholder="Комментарий по итогам заказа"
                                />
                              </FormItem>
                              <div className="ed-action-row">
                                <Button
                                  size="s"
                                  stretched
                                  onClick={() => updateOrderStatus(order.orderId, { status: 'Выполнено', note: completionNote })}
                                >
                                  Сохранить и завершить
                                </Button>
                                <Button
                                  size="s"
                                  mode="secondary"
                                  stretched
                                  onClick={() => {
                                    setCompletingOrderId('');
                                    setCompletionNote('');
                                  }}
                                >
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="ed-action-row">
                              <Button
                                size="s"
                                stretched
                                onClick={() => {
                                  setCompletingOrderId(order.orderId);
                                  setCompletionNote('');
                                }}
                              >
                                Отметить как выполненное
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  </CardGrid>
                );
                })}
              </>
            ) : (
              <div className="ed-empty">Нет записей, требующих подтверждения</div>
            )}

            {completedOrders.length > 0 ? (
              <>
                <div className="ed-section-title">Подтверждены (история)</div>
                {completedOrders.map((order) => {
                  const status = getStatusMeta(order.serviceStatus || order['Статус']);
                  const orderDate = order.orderDate
                    ? new Date(order.orderDate).toLocaleString('ru-RU')
                    : 'Дата не указана';
                  const startLabel = order.startTime
                    ? new Date(order.startTime).toLocaleString('ru-RU')
                    : 'Не указано';
                  const endLabel = order.endTime
                    ? new Date(order.endTime).toLocaleString('ru-RU')
                    : 'Не указано';
                  const servicesLabel = order.services.length > 0
                    ? order.services.join(', ')
                    : (order.serviceName || 'Не указана');
                  const petLabel = [
                    order.petName || 'Питомец',
                    order.petBreed ? `(${order.petBreed})` : '',
                    order.petKind || '',
                  ].filter(Boolean).join(' ');

                  return (
                    <CardGrid key={order.orderId} size="l">
                      <Card mode="shadow" className="ed-card ed-orders-card">
                        <SimpleCell
                          before={<Avatar size={48} initials={order.clientName?.charAt(0) || 'К'} />}
                          after={<Badge mode={status.mode}>{status.label}</Badge>}
                          description={`Клиент: ${order.clientName || 'Клиент'} · ${petLabel}`}
                        >
                          {servicesLabel}
                        </SimpleCell>
                        <div className="ed-order-details">
                          <div className="ed-detail-row"><strong>Дата оформления:</strong> {orderDate}</div>
                          <div className="ed-detail-row"><strong>Начало:</strong> {startLabel}</div>
                          <div className="ed-detail-row"><strong>Окончание:</strong> {endLabel}</div>
                          <div className="ed-detail-row"><strong>Статус заказа:</strong> {status.label}</div>
                          <div className="ed-detail-row"><strong>Владелец:</strong> {order.clientName || 'Не указан'}</div>
                          <div className="ed-detail-row"><strong>Кличка питомца:</strong> {order.petName || 'Не указана'}</div>
                          <div className="ed-detail-row"><strong>Порода:</strong> {order.petBreed || 'Не указана'}</div>
                          <div className="ed-detail-row"><strong>Вид:</strong> {order.petKind || 'Не указан'}</div>
                          <div className="ed-detail-row"><strong>Длительность:</strong> {order.duration ? `${order.duration} мин` : 'Не указана'}</div>
                          <div className="ed-detail-row"><strong>Стоимость заказа:</strong> {order.orderTotal ? `${Number(order.orderTotal).toFixed(2)} ₽` : 'Не указана'}</div>
                          <div className="ed-detail-row"><strong>Размер питомца:</strong> {SIZE_LABELS[order.petSize] || order.petSize || 'Не указан'}</div>
                          <div className="ed-detail-row"><strong>Возраст питомца:</strong> {order.petAge ?? 'Не указан'}</div>
                          <div className="ed-detail-row"><strong>Последний визит:</strong> {order.details?.lastVisit || 'Не указан'}</div>
                          <div className="ed-detail-row"><strong>Комментарий клиента:</strong> {order.details?.clientComment || 'Нет'}</div>
                          <div className="ed-detail-row"><strong>Комментарий мастера:</strong> {order.details?.masterComment || 'Нет'}</div>
                        </div>
                      </Card>
                    </CardGrid>
                  );
                })}
              </>
            ) : null}
          </Group>
          ) : null}

          {activeTab === 'schedule' ? (
          <Group className="ed-group" header={<Header mode="secondary">Моё расписание</Header>}>
            <CardGrid size="l">
              <Card ref={scheduleFormRef} mode="shadow" className="ed-card ed-schedule-form-card">
                <div className="ed-schedule-form">
                  <div className="ed-form-title">
                    {editingScheduleId ? 'Редактирование смены' : 'Добавление смены'}
                  </div>
                  <FormItem top="Дата">
                    <Input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={scheduleForm.date}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, date: e.target.value }))}
                    />
                  </FormItem>
                  <FormItem top="Время начала">
                    <Input
                      type="time"
                      value={scheduleForm.startTime}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, startTime: e.target.value }))}
                    />
                  </FormItem>
                  <FormItem top="Время окончания">
                    <Input
                      type="time"
                      value={scheduleForm.endTime}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, endTime: e.target.value }))}
                    />
                  </FormItem>
                  <FormItem top="Должность">
                    <NativeSelect
                      value={scheduleForm.roleId}
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, roleId: e.target.value }))}
                    >
                      <option value="">Выберите роль</option>
                      {roleOptions.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormItem>
                  <div className="ed-form-actions">
                    <Button size="m" onClick={handleSaveSchedule} disabled={savingSchedule}>
                      {editingScheduleId ? 'Сохранить изменения' : 'Добавить смену'}
                    </Button>
                    {editingScheduleId ? (
                      <Button size="m" mode="secondary" onClick={resetScheduleForm}>
                        Отменить
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            </CardGrid>

            {scheduleSummary.upcoming.length > 0 ? (
              <>
                <div className="ed-section-title">Ближайшие смены</div>
                {scheduleSummary.upcoming.slice(0, visibleUpcomingShifts).map((entry) => (
                <CardGrid key={entry.scheduleId} size="l">
                  <Card mode="shadow" className="ed-card ed-schedule-card">
                    <div className="ed-schedule-head">
                      <div>
                        <div className="ed-schedule-date">{entry.dateLabel}</div>
                        <div className="ed-schedule-role">{entry.roleName || 'Должность не указана'}</div>
                      </div>
                      <Badge>{entry.isGroomerShift ? `${entry.bookingsCount} записей` : `${entry.shiftHours.toFixed(1)} ч`}</Badge>
                    </div>
                    <div className="ed-schedule-time">{entry.timeLabel}</div>
                    <div className="ed-schedule-meta">
                      <div className="ed-detail-row"><strong>Роль в смене:</strong> {entry.roleName || 'Не указана'}</div>
                      <div className="ed-detail-row"><strong>Часы работы:</strong> {entry.shiftHours > 0 ? `${entry.shiftHours.toFixed(1)} ч` : 'Не указаны'}</div>
                      <div className="ed-detail-row"><strong>Рабочая смена:</strong> {entry.timeLabel}</div>
                      <div className="ed-detail-row"><strong>Фактическое время работы:</strong> {entry.actualTimeLabel}</div>
                      {entry.isGroomerShift ? (
                        <>
                          <div className="ed-detail-row"><strong>Выручка по выполненным заказам:</strong> {entry.shiftRevenue > 0 ? formatMoney(entry.shiftRevenue) : 'Нет записей'}</div>
                          <div className="ed-detail-row"><strong>Ставка за смену:</strong> {entry.salaryRate > 0 ? `${Math.round(entry.salaryRate * 100)}%` : 'Не задана'}</div>
                          <div className="ed-detail-row"><strong>Зарплата по выполненным заказам:</strong> {entry.shiftRevenue > 0 ? formatMoney(entry.payoutSalary) : '0.00 ₽'}</div>
                        </>
                      ) : (
                        <>
                          <div className="ed-detail-row"><strong>Почасовая ставка:</strong> {entry.hourlyRate > 0 ? `${entry.hourlyRate.toFixed(0)} ₽/ч` : 'Не задана'}</div>
                          <div className="ed-detail-row"><strong>Зарплата за смену:</strong> {formatMoney(entry.shiftSalary)}</div>
                        </>
                      )}
                    </div>
                    {entry.isGroomerShift && entry.bookings.length > 0 ? (
                      <div className="ed-shift-bookings">
                        {entry.bookings.map((booking) => {
                          const bookingStatus = getStatusMeta(booking.serviceStatus || booking['Статус']);
                          const petSize = SIZE_LABELS[booking.petSize] || booking.petSize || 'Не указан';
                          return (
                            <div key={`${entry.scheduleId}-${booking.orderId}`} className="ed-booking-item">
                              <div className="ed-booking-head">
                                <div className="ed-booking-title">{booking.services.join(', ')}</div>
                                <Badge mode={bookingStatus.mode}>{bookingStatus.label}</Badge>
                              </div>
                              <div className="ed-detail-row"><strong>Клиент:</strong> {booking.clientName || 'Не указан'}</div>
                              <div className="ed-detail-row"><strong>Статус заказа:</strong> {bookingStatus.label}</div>
                              <div className="ed-detail-row"><strong>Питомец:</strong> {booking.petName || 'Не указан'}{booking.petBreed ? ` (${booking.petBreed})` : ''} · {booking.petKind || 'Вид не указан'} · {petSize}</div>
                              <div className="ed-detail-row"><strong>Запись:</strong> {formatDateTime(booking.startTime)} - {formatDateTime(booking.endTime)}</div>
                              <div className="ed-detail-row"><strong>Длительность:</strong> {booking.duration ? `${booking.duration} мин` : 'Не указана'}</div>
                              <div className="ed-detail-row"><strong>Стоимость записи:</strong> {booking.orderTotal ? `${Number(booking.orderTotal).toFixed(2)} ₽` : 'Не указана'}</div>
                              <div className="ed-detail-row"><strong>Возраст питомца:</strong> {booking.petAge ?? 'Не указан'}</div>
                              <div className="ed-detail-row"><strong>Последний визит:</strong> {booking.details?.lastVisit || 'Не указан'}</div>
                              <div className="ed-detail-row"><strong>Комментарий клиента:</strong> {booking.details?.clientComment || 'Нет'}</div>
                              <div className="ed-detail-row"><strong>Комментарий мастера:</strong> {booking.details?.masterComment || 'Нет'}</div>
                            </div>
                          );
                        })}
                      </div>
                    ) : !entry.isGroomerShift ? (
                      <div className="ed-empty">Для административной смены записи и выручка не показываются.</div>
                    ) : (
                      <div className="ed-empty">В этой смене пока нет записей</div>
                    )}
                    {!entry.isPast ? (
                      <div className="ed-card-actions">
                        <div className="ed-action-row">
                          {entry.isGroomerShift ? (
                            <Button size="s" mode="secondary" onClick={() => handleEditSchedule(entry)}>
                              Редактировать
                            </Button>
                          ) : null}
                          <Button size="s" mode="destructive" onClick={() => handleDeleteSchedule(entry.scheduleId)}>
                            Удалить
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Card>
                </CardGrid>
                ))}
                {scheduleSummary.upcoming.length > visibleUpcomingShifts ? (
                  <div className="ed-more-row">
                    <Button mode="secondary" size="m" onClick={() => setVisibleUpcomingShifts((prev) => prev + 4)}>
                      Показать ещё смены
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="ed-empty">Ближайших смен пока нет</div>
            )}

            {scheduleSummary.past.length > 0 ? (
              <>
                <div className="ed-section-title">Отработанные смены</div>
                {scheduleSummary.past.slice(0, visiblePastShifts).map((entry) => (
                <CardGrid key={entry.scheduleId} size="l">
                  <Card mode="shadow" className="ed-card ed-schedule-card">
                    <div className="ed-schedule-head">
                      <div>
                        <div className="ed-schedule-date">{entry.dateLabel}</div>
                        <div className="ed-schedule-role">{entry.roleName || 'Должность не указана'}</div>
                      </div>
                      <Badge>{entry.isGroomerShift ? `${entry.bookingsCount} записей` : `${entry.shiftHours.toFixed(1)} ч`}</Badge>
                    </div>
                    <div className="ed-schedule-time">{entry.timeLabel}</div>
                    <div className="ed-schedule-meta">
                      <div className="ed-detail-row"><strong>Роль в смене:</strong> {entry.roleName || 'Не указана'}</div>
                      <div className="ed-detail-row"><strong>Часы работы:</strong> {entry.shiftHours > 0 ? `${entry.shiftHours.toFixed(1)} ч` : 'Не указаны'}</div>
                      <div className="ed-detail-row"><strong>Рабочая смена:</strong> {entry.timeLabel}</div>
                      <div className="ed-detail-row"><strong>Фактическое время работы:</strong> {entry.actualTimeLabel}</div>
                      {entry.isGroomerShift ? (
                        <>
                          <div className="ed-detail-row"><strong>Выручка по выполненным заказам:</strong> {entry.shiftRevenue > 0 ? formatMoney(entry.shiftRevenue) : 'Нет записей'}</div>
                          <div className="ed-detail-row"><strong>Ставка за смену:</strong> {entry.salaryRate > 0 ? `${Math.round(entry.salaryRate * 100)}%` : 'Не задана'}</div>
                          <div className="ed-detail-row"><strong>Зарплата по выполненным заказам:</strong> {entry.shiftRevenue > 0 ? formatMoney(entry.payoutSalary) : '0.00 ₽'}</div>
                        </>
                      ) : (
                        <>
                          <div className="ed-detail-row"><strong>Почасовая ставка:</strong> {entry.hourlyRate > 0 ? `${entry.hourlyRate.toFixed(0)} ₽/ч` : 'Не задана'}</div>
                          <div className="ed-detail-row"><strong>Зарплата за смену:</strong> {formatMoney(entry.shiftSalary)}</div>
                        </>
                      )}
                    </div>
                    {entry.isGroomerShift && entry.bookings.length > 0 ? (
                      <div className="ed-shift-bookings">
                        {entry.bookings.map((booking) => {
                          const bookingStatus = getStatusMeta(booking.serviceStatus || booking['Статус']);
                          const petSize = SIZE_LABELS[booking.petSize] || booking.petSize || 'Не указан';
                          return (
                            <div key={`${entry.scheduleId}-${booking.orderId}`} className="ed-booking-item">
                              <div className="ed-booking-head">
                                <div className="ed-booking-title">{booking.services.join(', ')}</div>
                                <Badge mode={bookingStatus.mode}>{bookingStatus.label}</Badge>
                              </div>
                              <div className="ed-detail-row"><strong>Клиент:</strong> {booking.clientName || 'Не указан'}</div>
                              <div className="ed-detail-row"><strong>Статус заказа:</strong> {bookingStatus.label}</div>
                              <div className="ed-detail-row"><strong>Питомец:</strong> {booking.petName || 'Не указан'}{booking.petBreed ? ` (${booking.petBreed})` : ''} · {booking.petKind || 'Вид не указан'} · {petSize}</div>
                              <div className="ed-detail-row"><strong>Запись:</strong> {formatDateTime(booking.startTime)} - {formatDateTime(booking.endTime)}</div>
                              <div className="ed-detail-row"><strong>Длительность:</strong> {booking.duration ? `${booking.duration} мин` : 'Не указана'}</div>
                              <div className="ed-detail-row"><strong>Стоимость записи:</strong> {booking.orderTotal ? `${Number(booking.orderTotal).toFixed(2)} ₽` : 'Не указана'}</div>
                              <div className="ed-detail-row"><strong>Возраст питомца:</strong> {booking.petAge ?? 'Не указан'}</div>
                              <div className="ed-detail-row"><strong>Последний визит:</strong> {booking.details?.lastVisit || 'Не указан'}</div>
                              <div className="ed-detail-row"><strong>Комментарий клиента:</strong> {booking.details?.clientComment || 'Нет'}</div>
                              <div className="ed-detail-row"><strong>Комментарий мастера:</strong> {booking.details?.masterComment || 'Нет'}</div>
                            </div>
                          );
                        })}
                      </div>
                    ) : !entry.isGroomerShift ? (
                      <div className="ed-empty">Для административной смены записи и выручка не показываются.</div>
                    ) : (
                      <div className="ed-empty">В этой смене не было записей</div>
                    )}
                    {!entry.isPast ? (
                      <div className="ed-card-actions">
                        <div className="ed-action-row">
                          {entry.isGroomerShift ? (
                            <Button size="s" mode="secondary" onClick={() => handleEditSchedule(entry)}>
                              Редактировать
                            </Button>
                          ) : null}
                          <Button size="s" mode="destructive" onClick={() => handleDeleteSchedule(entry.scheduleId)}>
                            Удалить
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Card>
                </CardGrid>
                ))}
                {scheduleSummary.past.length > visiblePastShifts ? (
                  <div className="ed-more-row">
                    <Button mode="secondary" size="m" onClick={() => setVisiblePastShifts((prev) => prev + 3)}>
                      Показать ещё архив
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}

          </Group>
          ) : null}

          {activeTab === 'stats' ? (
          <Group className="ed-group" header={<Header mode="secondary">Статистика по месяцам</Header>}>
            {monthlyStats.length > 0 ? (
              monthlyStats.map((month) => (
                <CardGrid key={month.key} size="l">
                  <Card mode="shadow" className="ed-card ed-month-card">
                    <div className="ed-month-title">{month.label}</div>
                    <div className="ed-month-grid">
                      <div className="ed-month-metric">
                        <div className="ed-month-label">Смен</div>
                        <div className="ed-month-value">{month.shifts}</div>
                      </div>
                      <div className="ed-month-metric">
                        <div className="ed-month-label">Отработано</div>
                        <div className="ed-month-value">{month.workedShifts}</div>
                      </div>
                      <div className="ed-month-metric">
                        <div className="ed-month-label">Запланировано</div>
                        <div className="ed-month-value">{month.plannedShifts}</div>
                      </div>
                      <div className="ed-month-metric">
                        <div className="ed-month-label">Записей</div>
                        <div className="ed-month-value">{month.bookings}</div>
                      </div>
                      <div className="ed-month-metric">
                        <div className="ed-month-label">К выплате</div>
                        <div className="ed-month-value">{formatMoney(month.payoutSalary)}</div>
                      </div>
                      <div className="ed-month-metric">
                        <div className="ed-month-label">Ожидаемая зарплата</div>
                        <div className="ed-month-value">{formatMoney(month.expectedSalary)}</div>
                      </div>
                      <div className="ed-month-metric">
                        <div className="ed-month-label">Выручка</div>
                        <div className="ed-month-value">{formatMoney(month.revenue)}</div>
                      </div>
                      <div className="ed-month-metric">
                        <div className="ed-month-label">Зарплата</div>
                        <div className="ed-month-value">{formatMoney(month.salary)}</div>
                      </div>
                    </div>
                  </Card>
                </CardGrid>
              ))
            ) : (
              <div className="ed-empty">Статистика пока не накоплена</div>
            )}
          </Group>
          ) : null}
        </div>
      )}
    </Panel>
  );
};

EmployeeDashboard.propTypes = {
  id: PropTypes.string.isRequired,
};

