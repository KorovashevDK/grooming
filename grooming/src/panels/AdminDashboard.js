import {
  Panel,
  PanelHeader,
  Group,
  Header,
  Card,
  Button,
  Badge,
  FormItem,
  Input,
  NativeSelect,
  Tabs,
  TabsItem,
} from '@vkontakte/vkui';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { adminApi } from '../api/endpoints';
import './AdminDashboard.css';

const ROLE_RATE_BY_ID = {
  '5EEFB7DC-57E8-404B-94D0-B641D7F6D696': 0.45,
  '882CB015-95ED-4C8E-B918-6E7C82606801': 0.35,
  'A0261582-900D-42C5-9C4B-6D6F60C23A36': 0.25,
};

const HOURLY_RATE_BY_ID = {
  '88FCD70F-3EA6-400D-B233-647C30C4EA7E': 350,
  'DD19D48D-A2C4-4E3C-A762-EB125B31BB19': 350,
  'CAEBA1F4-A104-4C06-A398-20BECA42B0B0': 250,
};

const SIZE_LABELS = {
  small: 'Маленький',
  medium: 'Средний',
  large: 'Большой',
};

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

const formatMoney = (value) => `${Number(value || 0).toFixed(2)} ₽`;

const formatDateTime = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleString('ru-RU') : 'Не указано';
};

const getStatusMeta = (status) => {
  if (/отмен|cancel/i.test(String(status || ''))) {
    return { mode: 'default', label: 'Отменён' };
  }
  if (/выполн|completed/i.test(String(status || ''))) {
    return { mode: 'positive', label: 'Выполнен' };
  }
  if (/процесс/i.test(String(status || ''))) {
    return { mode: 'warning', label: 'В процессе' };
  }
  return { mode: 'accent', label: status || 'Назначена' };
};

const getRoleRate = (roleId) => ROLE_RATE_BY_ID[roleId] || 0;
const getHourlyRate = (roleId) => HOURLY_RATE_BY_ID[roleId] || 0;

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const getDateKey = (value) => {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
};

const formatAgeLabel = (value) => {
  const age = Number(value);
  if (!Number.isFinite(age) || age <= 0) {
    return '';
  }
  const mod10 = age % 10;
  const mod100 = age % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${age} год`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${age} года`;
  }
  return `${age} лет`;
};

const formatDurationLabel = (minutes) => {
  const total = Number(minutes) || 0;
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

const groupOrderRows = (rows) => {
  const map = new Map();

  for (const row of rows || []) {
    const orderId = row.orderId || row['Код_заказа'];
    if (!orderId) {
      continue;
    }

    if (!map.has(orderId)) {
      map.set(orderId, {
        ...row,
        services: [],
        statuses: [],
        serviceRevenue: 0,
      });
    }

    const item = map.get(orderId);
    if (row.serviceName) item.services.push(row.serviceName);
    if (row.serviceStatus) item.statuses.push(row.serviceStatus);
    if (!item.note && row.note) item.note = row.note;
    if (!item.clientName && row.clientName) item.clientName = row.clientName;
    if (!item.employeeName && row.employeeName) item.employeeName = row.employeeName;
    if (!item.roleName && row.roleName) item.roleName = row.roleName;

    const startTime = toDate(row.startTime);
    const currentStart = toDate(item.startTime);
    if (startTime && (!currentStart || startTime.getTime() < currentStart.getTime())) {
      item.startTime = row.startTime;
    }

    const endTime = toDate(row.endTime);
    const currentEnd = toDate(item.endTime);
    if (endTime && (!currentEnd || endTime.getTime() > currentEnd.getTime())) {
      item.endTime = row.endTime;
    }

    item.serviceRevenue += Number(row.servicePrice) || 0;
    item.orderTotal = Number(item.orderTotal || row.orderTotal || item.serviceRevenue) || item.serviceRevenue;
  }

  return Array.from(map.values()).map((item) => {
    const startDate = toDate(item.startTime);
    const endDate = toDate(item.endTime);
    const duration = startDate && endDate
      ? Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000))
      : Number(item.duration) || 0;

    return {
      ...item,
      duration,
      details: parseBookingDetails(item.note),
    };
  });
};

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

export const AdminDashboard = ({ id }) => {
  const routeNavigator = useRouteNavigator();
  const { logout } = useAuth();
  const scheduleFormRef = useRef(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editingScheduleId, setEditingScheduleId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleFilterEmployeeId, setScheduleFilterEmployeeId] = useState('all');
  const [scheduleFilterRoleId, setScheduleFilterRoleId] = useState('all');
  const [scheduleFilterDate, setScheduleFilterDate] = useState('');
  const [scheduleFilterPeriod, setScheduleFilterPeriod] = useState('all');
  const [visibleUpcomingShifts, setVisibleUpcomingShifts] = useState(6);
  const [visiblePastShifts, setVisiblePastShifts] = useState(4);
  const [visibleLatestOrders, setVisibleLatestOrders] = useState(8);
  const [latestCompactMode, setLatestCompactMode] = useState(false);
  const [latestOrderFilters, setLatestOrderFilters] = useState({
    employeeId: 'all',
    status: 'all',
    date: '',
    ownerQuery: '',
    petQuery: '',
    sort: 'date_asc',
  });
  const [scheduleForm, setScheduleForm] = useState({
    employeeId: '',
    roleId: '',
    date: '',
    startTime: '',
    endTime: '',
  });

  const loadDashboard = async () => {
    const data = await adminApi.getDashboard();
    setDashboard(data);
    setScheduleForm((prev) => ({
      employeeId: prev.employeeId || data.employees?.[0]?.employeeId || '',
      roleId: prev.roleId || data.roles?.[0]?.roleId || '',
      date: prev.date,
      startTime: prev.startTime,
      endTime: prev.endTime,
    }));
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        await loadDashboard();
      } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        setErrorMessage(error?.data?.details || 'Не удалось загрузить панель управления');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const groupedOrders = useMemo(() => {
    const map = new Map();
    for (const row of dashboard?.orders || []) {
      if (!map.has(row.orderId)) {
        map.set(row.orderId, {
          ...row,
          services: [],
          statuses: [],
        });
      }
      const item = map.get(row.orderId);
      if (row.serviceName) item.services.push(row.serviceName);
      if (row.serviceStatus) item.statuses.push(row.serviceStatus);
      if (!item.startTime && row.startTime) item.startTime = row.startTime;
      if (!item.endTime && row.endTime) item.endTime = row.endTime;
      if (!item.duration && row.duration) item.duration = row.duration;
      if (!item.note && row.note) item.note = row.note;
      if (!item.employeeName && row.employeeName) item.employeeName = row.employeeName;
      if (!item.roleName && row.roleName) item.roleName = row.roleName;
      item.serviceRevenue = (item.serviceRevenue || 0) + (Number(row.servicePrice) || 0);
      item.details = parseBookingDetails(item.note);
    }

    return Array.from(map.values()).map((item) => {
      const startDate = toDate(item.startTime);
      const endDate = toDate(item.endTime);
      const actualDuration = startDate && endDate
        ? Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000))
        : Number(item.duration) || 0;

      return {
        ...item,
        duration: actualDuration,
      };
    });
  }, [dashboard]);

  const filteredLatestOrders = useMemo(() => {
    const employeeFilter = latestOrderFilters.employeeId;
    const statusFilter = latestOrderFilters.status;
    const ownerQuery = normalizeText(latestOrderFilters.ownerQuery);
    const petQuery = normalizeText(latestOrderFilters.petQuery);
    const dateFilter = latestOrderFilters.date;

    const filtered = groupedOrders.filter((order) => {
      const statusLabel = getStatusMeta(order.statuses[0] || order.serviceStatus).label;
      const orderDate = toDate(order.startTime) || toDate(order.orderDate);
      const orderDateKey = orderDate ? orderDate.toISOString().slice(0, 10) : '';

      if (employeeFilter !== 'all' && order.employeeId !== employeeFilter) {
        return false;
      }
      if (statusFilter !== 'all' && statusLabel !== statusFilter) {
        return false;
      }
      if (dateFilter && orderDateKey !== dateFilter) {
        return false;
      }
      if (ownerQuery && !normalizeText(order.clientName).includes(ownerQuery)) {
        return false;
      }
      if (petQuery) {
        const petHaystack = [order.petName, order.petBreed, order.petKind].map(normalizeText).join(' ');
        if (!petHaystack.includes(petQuery)) {
          return false;
        }
      }

      return true;
    });

    const sorted = [...filtered];
    if (latestOrderFilters.sort === 'date_desc') {
      sorted.sort((a, b) => (toDate(b.startTime)?.getTime() || toDate(b.orderDate)?.getTime() || 0) - (toDate(a.startTime)?.getTime() || toDate(a.orderDate)?.getTime() || 0));
    } else if (latestOrderFilters.sort === 'created_desc') {
      sorted.sort((a, b) => (toDate(b.orderDate)?.getTime() || 0) - (toDate(a.orderDate)?.getTime() || 0));
    } else if (latestOrderFilters.sort === 'price_desc') {
      sorted.sort((a, b) => (Number(b.orderTotal) || 0) - (Number(a.orderTotal) || 0));
    } else {
      sorted.sort((a, b) => (toDate(a.startTime)?.getTime() || toDate(a.orderDate)?.getTime() || 0) - (toDate(b.startTime)?.getTime() || toDate(b.orderDate)?.getTime() || 0));
    }

    return sorted;
  }, [groupedOrders, latestOrderFilters]);

  const roleNamesByEmployeeDate = useMemo(() => {
    const map = new Map();

    for (const entry of dashboard?.schedule || []) {
      const employeeId = entry.employeeId;
      const dateKey = entry.scheduleDate ? String(entry.scheduleDate).split('T')[0] : '';
      if (!employeeId || !dateKey || !entry.roleName) {
        continue;
      }

      const key = `${employeeId}_${dateKey}`;
      if (!map.has(key)) {
        map.set(key, new Set());
      }
      map.get(key).add(entry.roleName);
    }

    return map;
  }, [dashboard]);

  const resetLatestOrderFilters = () => {
    setLatestOrderFilters({
      employeeId: 'all',
      status: 'all',
      date: '',
      ownerQuery: '',
      petQuery: '',
      sort: 'date_asc',
    });
  };

  const applyLatestQuickFilter = (preset) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const toKey = (date) => date.toISOString().slice(0, 10);

    if (preset === 'today') {
      setLatestOrderFilters((prev) => ({ ...prev, date: toKey(today), sort: 'date_asc' }));
      return;
    }
    if (preset === 'tomorrow') {
      setLatestOrderFilters((prev) => ({ ...prev, date: toKey(tomorrow), sort: 'date_asc' }));
      return;
    }
    if (preset === 'completed') {
      setLatestOrderFilters((prev) => ({ ...prev, status: 'Выполнен', sort: 'date_asc' }));
      return;
    }
    if (preset === 'cancelled') {
      setLatestOrderFilters((prev) => ({ ...prev, status: 'Отменён', sort: 'date_asc' }));
    }
  };

  useEffect(() => {
    setVisibleLatestOrders(8);
  }, [latestOrderFilters]);

  const scheduleSummary = useMemo(() => {
    const allShifts = (dashboard?.schedule || []).map((entry) => {
      const scheduleDate = entry.scheduleDate ? String(entry.scheduleDate).split('T')[0] : null;
      const startMinutes = toTimeMinutes(entry.scheduleStart);
      const endMinutes = toTimeMinutes(entry.scheduleEnd);
      const isGroomerShift = getRoleRate(entry.roleId) > 0;
      const rawBookings = (isGroomerShift ? (dashboard?.orders || []) : [])
        .filter((order) => {
          if (entry.employeeId !== order.employeeId) return false;
          const orderStart = toDate(order.startTime);
          const orderEnd = toDate(order.endTime);
          if (!orderStart || !orderEnd || !scheduleDate) return false;
          const orderDate = orderStart.toISOString().slice(0, 10);
          const orderStartMinutes = orderStart.getHours() * 60 + orderStart.getMinutes();
          const orderEndMinutes = orderEnd.getHours() * 60 + orderEnd.getMinutes();
          return orderDate === scheduleDate && startMinutes !== null && endMinutes !== null && orderStartMinutes >= startMinutes && orderEndMinutes <= endMinutes;
        })
        .sort((a, b) => (toDate(a.startTime)?.getTime() || 0) - (toDate(b.startTime)?.getTime() || 0));
      const bookings = groupOrderRows(rawBookings).sort((a, b) => (toDate(a.startTime)?.getTime() || 0) - (toDate(b.startTime)?.getTime() || 0));

      const shiftStart = scheduleDate && entry.scheduleStart ? new Date(`${scheduleDate}T${entry.scheduleStart}:00`) : null;
      const shiftEnd = scheduleDate && entry.scheduleEnd ? new Date(`${scheduleDate}T${entry.scheduleEnd}:00`) : null;
      const shiftRevenue = bookings.reduce((sum, item) => sum + (Number(item.orderTotal || item.serviceRevenue) || 0), 0);
      const salaryRate = getRoleRate(entry.roleId);
      const hourlyRate = getHourlyRate(entry.roleId);
      const actualDurationMinutes = bookings.reduce((sum, booking) => {
        const bookingStart = toDate(booking.startTime);
        const bookingEnd = toDate(booking.endTime);
        if (!bookingStart || !bookingEnd) {
          return sum;
        }
        return sum + Math.max(0, Math.round((bookingEnd.getTime() - bookingStart.getTime()) / 60000));
      }, 0);
      const shiftHours = startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
        ? (endMinutes - startMinutes) / 60
        : 0;
      const shiftSalary = isGroomerShift ? shiftRevenue * salaryRate : shiftHours * hourlyRate;

      return {
        ...entry,
        dateLabel: entry.scheduleDate ? new Date(entry.scheduleDate).toLocaleDateString('ru-RU') : 'Дата не указана',
        timeLabel: `${entry.scheduleStart || '--:--'}–${entry.scheduleEnd || '--:--'}`,
        actualTimeLabel: formatDurationLabel(actualDurationMinutes),
        bookings,
        bookingsCount: bookings.length,
        shiftRevenue,
        shiftSalary,
        salaryRate,
        hourlyRate,
        isGroomerShift,
        shiftHours,
        sortTime: shiftStart?.getTime() || 0,
        isPast: shiftEnd ? shiftEnd.getTime() < Date.now() : false,
      };
    });

    const filtered = allShifts.filter((entry) => {
      const entryDateKey = entry.scheduleDate ? String(entry.scheduleDate).split('T')[0] : '';

      if (scheduleFilterEmployeeId !== 'all' && entry.employeeId !== scheduleFilterEmployeeId) {
        return false;
      }
      if (scheduleFilterRoleId !== 'all' && entry.roleId !== scheduleFilterRoleId) {
        return false;
      }
      if (scheduleFilterDate && entryDateKey !== scheduleFilterDate) {
        return false;
      }
      if (scheduleFilterPeriod === 'upcoming' && entry.isPast) {
        return false;
      }
      if (scheduleFilterPeriod === 'past' && !entry.isPast) {
        return false;
      }

      return true;
    });

    return {
      upcoming: filtered.filter((item) => !item.isPast).sort((a, b) => a.sortTime - b.sortTime),
      past: filtered.filter((item) => item.isPast).sort((a, b) => b.sortTime - a.sortTime),
    };
  }, [dashboard, scheduleFilterDate, scheduleFilterEmployeeId, scheduleFilterPeriod, scheduleFilterRoleId]);

  const roleOptions = dashboard?.roles || [];
  const employeeOptions = dashboard?.employees || [];
  const monthlyStats = dashboard?.monthlyStats || [];
  const summary = dashboard?.summary || {};

  const resetScheduleForm = () => {
    setEditingScheduleId('');
    setScheduleForm({
      employeeId: employeeOptions[0]?.employeeId || '',
      roleId: roleOptions[0]?.roleId || '',
      date: '',
      startTime: '',
      endTime: '',
    });
  };

  const handleSaveSchedule = async () => {
    if (!scheduleForm.employeeId || !scheduleForm.roleId || !scheduleForm.date || !scheduleForm.startTime || !scheduleForm.endTime) {
      return;
    }
    if (scheduleForm.startTime >= scheduleForm.endTime) {
      setErrorMessage('Время окончания смены должно быть позже времени начала');
      return;
    }

    setSavingSchedule(true);
    try {
      setErrorMessage('');
      if (editingScheduleId) {
        await adminApi.updateSchedule(editingScheduleId, scheduleForm);
      } else {
        await adminApi.createSchedule(scheduleForm);
      }
      await loadDashboard();
      resetScheduleForm();
    } catch (error) {
      console.error('Error saving admin schedule:', error);
      setErrorMessage(error?.data?.details || 'Не удалось сохранить смену');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleEditSchedule = (entry) => {
    setEditingScheduleId(entry.scheduleId);
    setScheduleForm({
      employeeId: entry.employeeId || '',
      roleId: entry.roleId || '',
      date: entry.scheduleDate ? entry.scheduleDate.split('T')[0] : '',
      startTime: entry.scheduleStart || '',
      endTime: entry.scheduleEnd || '',
    });
    window.requestAnimationFrame(() => {
      scheduleFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      setErrorMessage('');
      await adminApi.deleteSchedule(scheduleId);
      await loadDashboard();
    } catch (error) {
      console.error('Error deleting admin schedule:', error);
      setErrorMessage(error?.data?.details || 'Не удалось удалить смену');
    }
  };

  useEffect(() => {
    setVisibleUpcomingShifts(6);
    setVisiblePastShifts(4);
  }, [activeTab, scheduleFilterDate, scheduleFilterEmployeeId, scheduleFilterPeriod, scheduleFilterRoleId]);

  return (
    <Panel id={id} className="employee-dashboard admin-dashboard">
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
        Пёс Пижон · Панель управления
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
              <div className="ed-hero-title">Общее расписание, заказы и экономика салона</div>
              <div className="ed-hero-subtitle">
                Управляйте сменами всей команды, контролируйте загрузку и держите под рукой выручку, зарплату и динамику по месяцам.
              </div>
            </div>
            <div className="ed-hero-stats">
              <div className="ed-stat">
                <div className="ed-stat-label">Заказов</div>
                <div className="ed-stat-value">{summary.totalOrders || 0}</div>
              </div>
              <div className="ed-stat">
                <div className="ed-stat-label">Активные</div>
                <div className="ed-stat-value">{summary.activeOrders || 0}</div>
              </div>
              <div className="ed-stat">
                <div className="ed-stat-label">Смен</div>
                <div className="ed-stat-value">{summary.totalShifts || 0}</div>
              </div>
              <div className="ed-stat">
                <div className="ed-stat-label">Ближайшие смены</div>
                <div className="ed-stat-value">{scheduleSummary.upcoming.length}</div>
              </div>
            </div>
          </section>

          <section className="ed-summary-grid">
            <div className="ed-summary-card">
              <div className="ed-summary-label">Выручка за всё время</div>
              <div className="ed-summary-value">{formatMoney(summary.totalRevenue)}</div>
            </div>
            <div className="ed-summary-card">
              <div className="ed-summary-label">Расчётная зарплата</div>
              <div className="ed-summary-value">{formatMoney(summary.totalSalary)}</div>
            </div>
            <div className="ed-summary-card">
              <div className="ed-summary-label">Выручка текущего месяца</div>
              <div className="ed-summary-value">{formatMoney(summary.currentMonthRevenue)}</div>
            </div>
            <div className="ed-summary-card">
              <div className="ed-summary-label">Клиентов / сотрудников</div>
              <div className="ed-summary-value">{summary.totalClients || 0} / {summary.totalEmployees || 0}</div>
            </div>
          </section>

          {errorMessage ? <div className="ed-empty">{errorMessage}</div> : null}

          <Tabs className="ed-tabs">
            <TabsItem
              id="admin-tab-overview"
              aria-controls="admin-tabpanel-overview"
              selected={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            >
              Обзор
            </TabsItem>
            <TabsItem
              id="admin-tab-schedule"
              aria-controls="admin-tabpanel-schedule"
              selected={activeTab === 'schedule'}
              onClick={() => setActiveTab('schedule')}
            >
              Расписание
            </TabsItem>
            <TabsItem
              id="admin-tab-stats"
              aria-controls="admin-tabpanel-stats"
              selected={activeTab === 'stats'}
              onClick={() => setActiveTab('stats')}
            >
              Статистика
            </TabsItem>
          </Tabs>

          {activeTab === 'overview' ? (
            <div id="admin-tabpanel-overview" role="tabpanel" aria-labelledby="admin-tab-overview" className="adm-panel-gap">
              <div className="adm-grid">
                <Group className="adm-overview-group" header={<Header mode="secondary">Фильтры заказов</Header>}>
                  <div className="adm-form-grid">
                    <FormItem top="Сотрудник">
                      <NativeSelect
                        value={latestOrderFilters.employeeId}
                        onChange={(e) => setLatestOrderFilters((prev) => ({ ...prev, employeeId: e.target.value }))}
                      >
                        <option value="all">Все сотрудники</option>
                        {employeeOptions.map((employee) => (
                          <option key={employee.employeeId} value={employee.employeeId}>{employee.fullName}</option>
                        ))}
                      </NativeSelect>
                    </FormItem>
                    <FormItem top="Статус">
                      <NativeSelect
                        value={latestOrderFilters.status}
                        onChange={(e) => setLatestOrderFilters((prev) => ({ ...prev, status: e.target.value }))}
                      >
                        <option value="all">Все статусы</option>
                        <option value="Назначена">Назначена</option>
                        <option value="Выполнен">Выполнен</option>
                        <option value="Отменён">Отменён</option>
                      </NativeSelect>
                    </FormItem>
                    <FormItem top="Дата записи">
                      <Input
                        type="date"
                        value={latestOrderFilters.date}
                        onChange={(e) => setLatestOrderFilters((prev) => ({ ...prev, date: e.target.value }))}
                      />
                    </FormItem>
                    <FormItem top="Владелец">
                      <Input
                        value={latestOrderFilters.ownerQuery}
                        placeholder="Имя или фамилия"
                        onChange={(e) => setLatestOrderFilters((prev) => ({ ...prev, ownerQuery: e.target.value }))}
                      />
                    </FormItem>
                    <FormItem top="Питомец">
                      <Input
                        value={latestOrderFilters.petQuery}
                        placeholder="Кличка, порода, вид"
                        onChange={(e) => setLatestOrderFilters((prev) => ({ ...prev, petQuery: e.target.value }))}
                      />
                    </FormItem>
                    <FormItem top="Сортировка">
                      <NativeSelect
                        value={latestOrderFilters.sort}
                        onChange={(e) => setLatestOrderFilters((prev) => ({ ...prev, sort: e.target.value }))}
                      >
                        <option value="date_asc">По записи: от ближайшей</option>
                        <option value="date_desc">По записи: от дальней</option>
                        <option value="created_desc">По оформлению: сначала новые</option>
                        <option value="price_desc">По стоимости: по убыванию</option>
                      </NativeSelect>
                    </FormItem>
                  </div>
                  <div className="ed-form-actions">
                    <Button mode="secondary" size="m" onClick={resetLatestOrderFilters}>
                      Сбросить фильтры
                    </Button>
                    <Button mode="secondary" size="m" onClick={() => setLatestCompactMode((prev) => !prev)}>
                      {latestCompactMode ? 'Подробный вид' : 'Компактный вид'}
                    </Button>
                  </div>

                  <div className="adm-chip-row">
                    <Button size="s" mode="secondary" onClick={() => applyLatestQuickFilter('today')}>
                      Сегодня
                    </Button>
                    <Button size="s" mode="secondary" onClick={() => applyLatestQuickFilter('tomorrow')}>
                      Завтра
                    </Button>
                    <Button size="s" mode="secondary" onClick={() => applyLatestQuickFilter('completed')}>
                      Выполненные
                    </Button>
                    <Button size="s" mode="secondary" onClick={() => applyLatestQuickFilter('cancelled')}>
                      Отменённые
                    </Button>
                  </div>
                </Group>
              </div>

              <Group className="adm-overview-group" header={<Header mode="secondary">Последние заказы</Header>}>
                {filteredLatestOrders.length ? filteredLatestOrders.slice(0, visibleLatestOrders).map((order) => {
                  const statusMeta = getStatusMeta(order.statuses[0] || order.serviceStatus);
                  const orderDateKey = getDateKey(order.startTime || order.orderDate);
                  const roleNames = Array.from(roleNamesByEmployeeDate.get(`${order.employeeId}_${orderDateKey}`) || []).sort((a, b) => String(a).localeCompare(String(b), 'ru'));
                  const roleLabel = roleNames.length ? roleNames.join(', ') : order.roleName;
                  return (
                    <Card key={order.orderId} mode="shadow" className={`adm-order-card${latestCompactMode ? ' adm-order-card-compact' : ''}`}>
                      <div className="adm-order-head">
                        <div>
                          <div className="ed-schedule-date">{order.clientName || 'Клиент не указан'}</div>
                          <div className="ed-schedule-time">🐾 {order.petName || 'Питомец'} · {order.petBreed || 'Без породы'}</div>
                        </div>
                        <Badge mode={statusMeta.mode}>{statusMeta.label}</Badge>
                      </div>
                      <div className="adm-service-list">
                        {order.services.map((serviceName, index) => (
                          <span key={`${order.orderId}-${serviceName}-${index}`} className="adm-service-chip">{serviceName}</span>
                        ))}
                      </div>
                      <div className="adm-order-meta">
                        <div>Оформление: {formatDateTime(order.orderDate)}</div>
                        <div>Запись: {formatDateTime(order.startTime)} — {formatDateTime(order.endTime)}</div>
                        <div>Сотрудник: {order.employeeName || 'Не назначен'}{roleLabel ? ` · ${roleLabel}` : ''}</div>
                        <div>Питомец: {order.petKind || '—'}{order.petAge ? ` · ${formatAgeLabel(order.petAge)}` : ''}{order.petSize ? ` · ${SIZE_LABELS[order.petSize] || order.petSize}` : ''}</div>
                        <div>Стоимость заказа: {formatMoney(order.orderTotal || order.serviceRevenue)}</div>
                        {!latestCompactMode ? (
                          <>
                            <div>Длительность: {order.duration || 0} мин</div>
                            <div>Последний визит: {order.details?.lastVisit || 'Не указан'}</div>
                            <div>Комментарий клиента: {order.details?.clientComment || 'Нет'}</div>
                            <div>Комментарий мастера: {order.details?.masterComment || 'Нет'}</div>
                          </>
                        ) : null}
                      </div>
                    </Card>
                  );
                }) : <div className="ed-empty">Заказы по выбранным фильтрам не найдены.</div>}
                {filteredLatestOrders.length > visibleLatestOrders ? (
                  <div className="ed-form-actions">
                    <Button mode="secondary" size="m" onClick={() => setVisibleLatestOrders((value) => value + 8)}>
                      Показать ещё
                    </Button>
                  </div>
                ) : null}
              </Group>
            </div>
          ) : null}

          {activeTab === 'schedule' ? (
            <div id="admin-tabpanel-schedule" role="tabpanel" aria-labelledby="admin-tab-schedule" className="adm-panel-gap">
              <div className="adm-grid">
                <Group ref={scheduleFormRef} className="adm-schedule-panel" header={<Header mode="secondary">Управление сменами</Header>}>
                  <div ref={scheduleFormRef} className="ed-schedule-form">
                    <div className="ed-form-title">{editingScheduleId ? 'Редактирование смены' : 'Добавление смены'}</div>
                    <div className="adm-form-grid">
                      <FormItem top="Сотрудник">
                        <NativeSelect
                          value={scheduleForm.employeeId}
                          onChange={(e) => setScheduleForm((prev) => ({ ...prev, employeeId: e.target.value }))}
                        >
                          {employeeOptions.map((employee) => (
                            <option key={employee.employeeId} value={employee.employeeId}>{employee.fullName}</option>
                          ))}
                        </NativeSelect>
                      </FormItem>
                      <FormItem top="Должность">
                        <NativeSelect
                          value={scheduleForm.roleId}
                          onChange={(e) => setScheduleForm((prev) => ({ ...prev, roleId: e.target.value }))}
                        >
                          {roleOptions.map((role) => (
                            <option key={role.roleId} value={role.roleId}>{role.roleName}</option>
                          ))}
                        </NativeSelect>
                      </FormItem>
                      <FormItem top="Дата">
                        <Input type="date" value={scheduleForm.date} onChange={(e) => setScheduleForm((prev) => ({ ...prev, date: e.target.value }))} />
                      </FormItem>
                      <FormItem top="Начало">
                        <Input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm((prev) => ({ ...prev, startTime: e.target.value }))} />
                      </FormItem>
                      <FormItem top="Окончание">
                        <Input type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm((prev) => ({ ...prev, endTime: e.target.value }))} />
                      </FormItem>
                    </div>
                    <div className="ed-form-actions">
                      <Button className="adm-primary-brown-text" size="m" onClick={handleSaveSchedule} loading={savingSchedule}>
                        {editingScheduleId ? 'Сохранить' : 'Добавить смену'}
                      </Button>
                      {editingScheduleId ? (
                        <Button size="m" mode="secondary" onClick={resetScheduleForm}>Сбросить</Button>
                      ) : null}
                    </div>
                  </div>
                </Group>

                <Group className="adm-schedule-panel" header={<Header mode="secondary">Фильтр расписания</Header>}>
                  <div className="adm-form-grid">
                    <FormItem top="Сотрудник">
                      <NativeSelect value={scheduleFilterEmployeeId} onChange={(e) => setScheduleFilterEmployeeId(e.target.value)}>
                        <option value="all">Все сотрудники</option>
                        {employeeOptions.map((employee) => (
                          <option key={employee.employeeId} value={employee.employeeId}>{employee.fullName}</option>
                        ))}
                      </NativeSelect>
                    </FormItem>
                    <FormItem top="Должность">
                      <NativeSelect value={scheduleFilterRoleId} onChange={(e) => setScheduleFilterRoleId(e.target.value)}>
                        <option value="all">Все должности</option>
                        {roleOptions.map((role) => (
                          <option key={role.roleId} value={role.roleId}>{role.roleName}</option>
                        ))}
                      </NativeSelect>
                    </FormItem>
                    <FormItem top="Дата">
                      <Input type="date" value={scheduleFilterDate} onChange={(e) => setScheduleFilterDate(e.target.value)} />
                    </FormItem>
                    <FormItem top="Период">
                      <NativeSelect value={scheduleFilterPeriod} onChange={(e) => setScheduleFilterPeriod(e.target.value)}>
                        <option value="all">Все смены</option>
                        <option value="upcoming">Ближайшие</option>
                        <option value="past">Архив</option>
                      </NativeSelect>
                    </FormItem>
                  </div>
                  <div className="ed-form-actions">
                    <Button
                      mode="secondary"
                      size="m"
                      onClick={() => {
                        setScheduleFilterEmployeeId('all');
                        setScheduleFilterRoleId('all');
                        setScheduleFilterDate('');
                        setScheduleFilterPeriod('all');
                      }}
                    >
                      Сбросить фильтры
                    </Button>
                  </div>
                </Group>
              </div>

              <div className="adm-section-title">Ближайшие смены</div>
              <Group>
                {scheduleSummary.upcoming.length ? scheduleSummary.upcoming.slice(0, visibleUpcomingShifts).map((entry) => (
                  <Card key={entry.scheduleId} mode="shadow" className="ed-schedule-card">
                    <div className="ed-schedule-head">
                      <div>
                        <div className="ed-schedule-date">{entry.employeeName || 'Сотрудник'} · {entry.dateLabel}</div>
                        <div className="ed-schedule-time">{entry.timeLabel}</div>
                      </div>
                      <Badge mode="accent">{entry.roleName || 'Без должности'}</Badge>
                    </div>
                    <div className="adm-shift-meta">
                      <div>Роль в смене: {entry.roleName || 'Не указана'}</div>
                      <div>Часы работы: {entry.shiftHours > 0 ? `${entry.shiftHours.toFixed(1)} ч` : 'Не указаны'}</div>
                      <div>Рабочая смена: {entry.timeLabel}</div>
                      <div>Фактическое время работы: {entry.actualTimeLabel}</div>
                      {entry.isGroomerShift ? (
                        <>
                          <div>Записей в смене: {entry.bookingsCount}</div>
                          <div>Выручка в смене: {formatMoney(entry.shiftRevenue)}</div>
                          <div>Ставка роли: {(entry.salaryRate * 100).toFixed(0)}%</div>
                          <div>Расчётная зарплата: {formatMoney(entry.shiftSalary)}</div>
                        </>
                      ) : (
                        <>
                          <div>Записей в смене: Не показываются для административной роли</div>
                          <div>Почасовая ставка: {entry.hourlyRate ? `${entry.hourlyRate} ₽/ч` : 'Не задана'}</div>
                          <div>Зарплата за смену: {formatMoney(entry.shiftSalary)}</div>
                        </>
                      )}
                    </div>
                    <div className="ed-card-actions">
                      <div className="ed-action-row">
                        <Button size="s" mode="secondary" onClick={() => handleEditSchedule(entry)}>Редактировать</Button>
                        <Button size="s" mode="destructive" onClick={() => handleDeleteSchedule(entry.scheduleId)}>Удалить</Button>
                      </div>
                    </div>
                    <div className="adm-bookings-list">
                      {entry.isGroomerShift && entry.bookings.length ? entry.bookings.map((booking, index) => {
                        const statusMeta = getStatusMeta(booking.serviceStatus);
                        return (
                          <div key={`${entry.scheduleId}-${booking.orderId}-${booking.serviceId || index}`} className="adm-booking-item">
                            <div className="adm-booking-head">
                              <div className="adm-booking-title">{booking.clientName || 'Клиент'} · {booking.petName || 'Питомец'}</div>
                              <Badge mode={statusMeta.mode}>{statusMeta.label}</Badge>
                            </div>
                            <div className="adm-booking-text">Услуги: {booking.services?.length ? booking.services.join(', ') : (booking.serviceName || 'Не указаны')}</div>
                            <div className="adm-booking-text">Время: {formatDateTime(booking.startTime)} — {formatDateTime(booking.endTime)}</div>
                            <div className="adm-booking-text">Длительность заказа: {booking.duration ? `${booking.duration} мин` : 'Не указана'}</div>
                            <div className="adm-booking-text">Статус заказа: {statusMeta.label}</div>
                            <div className="adm-booking-text">Стоимость записи: {formatMoney(booking.orderTotal || booking.serviceRevenue)}</div>
                            <div className="adm-booking-text">Питомец: {booking.petName || 'Не указан'}{booking.petBreed ? ` (${booking.petBreed})` : ''} · {booking.petKind || 'Вид не указан'}{booking.petSize ? ` · ${SIZE_LABELS[booking.petSize] || booking.petSize}` : ''}</div>
                            <div className="adm-booking-text">Возраст питомца: {formatAgeLabel(booking.petAge) || 'Не указан'}</div>
                            <div className="adm-booking-text">Последний визит: {parseBookingDetails(booking.note).lastVisit || 'Не указан'}</div>
                            <div className="adm-booking-text">Комментарий клиента: {parseBookingDetails(booking.note).clientComment || 'Нет'}</div>
                            <div className="adm-booking-text">Комментарий мастера: {parseBookingDetails(booking.note).masterComment || 'Нет'}</div>
                          </div>
                        );
                      }) : entry.isGroomerShift ? <div className="ed-empty">В этой смене пока нет записей.</div> : <div className="ed-empty">Для административной роли записи и выручка не показываются.</div>}
                    </div>
                  </Card>
                )) : <div className="ed-empty">Нет ближайших смен.</div>}
                {scheduleSummary.upcoming.length > visibleUpcomingShifts ? (
                  <div className="adm-show-more">
                    <Button mode="secondary" size="m" onClick={() => setVisibleUpcomingShifts((value) => value + 6)}>
                      Показать ещё смены
                    </Button>
                  </div>
                ) : null}
              </Group>

              <div className="adm-section-title">Архив смен</div>
              <Group>
                {scheduleSummary.past.length ? scheduleSummary.past.slice(0, visiblePastShifts).map((entry) => (
                  <Card key={entry.scheduleId} mode="shadow" className="ed-schedule-card">
                    <div className="ed-schedule-head">
                      <div>
                        <div className="ed-schedule-date">{entry.employeeName || 'Сотрудник'} · {entry.dateLabel}</div>
                        <div className="ed-schedule-time">{entry.timeLabel}</div>
                      </div>
                      <Badge mode="default">{entry.roleName || 'Без должности'}</Badge>
                    </div>
                    <div className="adm-shift-meta">
                      <div>Роль в смене: {entry.roleName || 'Не указана'}</div>
                      <div>Часы работы: {entry.shiftHours > 0 ? `${entry.shiftHours.toFixed(1)} ч` : 'Не указаны'}</div>
                      <div>Рабочая смена: {entry.timeLabel}</div>
                      <div>Фактическое время работы: {entry.actualTimeLabel}</div>
                      {entry.isGroomerShift ? (
                        <>
                          <div>Записей в смене: {entry.bookingsCount}</div>
                          <div>Выручка в смене: {formatMoney(entry.shiftRevenue)}</div>
                          <div>Расчётная зарплата: {formatMoney(entry.shiftSalary)}</div>
                        </>
                      ) : (
                        <>
                          <div>Записей в смене: Не показываются для административной роли</div>
                          <div>Почасовая ставка: {entry.hourlyRate ? `${entry.hourlyRate} ₽/ч` : 'Не задана'}</div>
                          <div>Зарплата за смену: {formatMoney(entry.shiftSalary)}</div>
                        </>
                      )}
                    </div>
                  </Card>
                )) : <div className="ed-empty">Архивных смен пока нет.</div>}
                {scheduleSummary.past.length > visiblePastShifts ? (
                  <div className="adm-show-more">
                    <Button mode="secondary" size="m" onClick={() => setVisiblePastShifts((value) => value + 6)}>
                      Показать ещё архив
                    </Button>
                  </div>
                ) : null}
              </Group>
            </div>
          ) : null}

          {activeTab === 'stats' ? (
            <div id="admin-tabpanel-stats" role="tabpanel" aria-labelledby="admin-tab-stats" className="adm-panel-gap">
              <Group header={<Header mode="secondary">Статистика по месяцам</Header>}>
                <div className="adm-month-grid">
                  {monthlyStats.length ? monthlyStats.map((month) => (
                    <div key={month.key} className="adm-month-card">
                      <div className="adm-month-title">{month.label}</div>
                      <div className="adm-month-stats">
                        <div>Заказов: {month.totalOrders}</div>
                        <div>Услуг: {month.totalServices}</div>
                        <div>Выполнено: {month.completedServices}</div>
                        <div>Отменено: {month.cancelledServices}</div>
                        <div>Смен: {month.shifts}</div>
                        <div>Выручка: {formatMoney(month.revenue)}</div>
                        <div>Зарплата: {formatMoney(month.salary)}</div>
                      </div>
                    </div>
                  )) : <div className="ed-empty">Пока нет статистики по месяцам.</div>}
                </div>
              </Group>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
};

AdminDashboard.propTypes = {
  id: PropTypes.string.isRequired,
};
