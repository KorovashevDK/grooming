import {
  Panel,
  PanelHeader,
  Group,
  Header,
  Card,
  CardGrid,
  SimpleCell,
  Avatar,
  Button,
  Badge,
  FormItem,
  NativeSelect,
  Input,
  Textarea,
  Tabs,
  TabsItem,
} from '@vkontakte/vkui';
import { useAuth } from '../contexts/AuthContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouteNavigator } from '@vkontakte/vk-mini-apps-router';
import PropTypes from 'prop-types';
import { clientApi, employeesApi, petsApi, servicesApi } from '../api/endpoints';
import './ClientDashboard.css';

const SIZE_LABELS = {
  small: 'Маленький',
  medium: 'Средний',
  large: 'Большой',
};

const SIZE_COEFFICIENTS = {
  small: 1,
  medium: 1.3,
  large: 1.6,
};

const GROOMER_LEVEL_LABELS = {
  'A0261582-900D-42C5-9C4B-6D6F60C23A36': 'Помощник грумера',
  '882CB015-95ED-4C8E-B918-6E7C82606801': 'Грумер',
  '5EEFB7DC-57E8-404B-94D0-B641D7F6D696': 'Старший грумер',
};

const GROOMER_LEVEL_COEFFICIENTS = {
  'A0261582-900D-42C5-9C4B-6D6F60C23A36': 0.9,
  '882CB015-95ED-4C8E-B918-6E7C82606801': 1,
  '5EEFB7DC-57E8-404B-94D0-B641D7F6D696': 1.1,
};

const getSizeModifierLabel = (size) => {
  if (size === 'medium') return 'надбавка 30%';
  if (size === 'large') return 'надбавка 60%';
  return 'без надбавки';
};

const getGroomerModifierLabel = (roleId) => {
  if (roleId === 'A0261582-900D-42C5-9C4B-6D6F60C23A36') return 'скидка 10%';
  if (roleId === '5EEFB7DC-57E8-404B-94D0-B641D7F6D696') return 'надбавка 10%';
  return 'без надбавки';
};

const GROOMING_RECENCY_OPTIONS = [
  { value: 'recent', label: 'Меньше месяца назад', modifier: 'без надбавки' },
  { value: '1_3_months', label: '1–3 месяца назад', modifier: 'надбавка 5%' },
  { value: '3_plus_months', label: 'Более 3 месяцев назад', modifier: 'надбавка 10%' },
  { value: 'never', label: 'Никогда', modifier: 'надбавка 15%' },
];

const getRecencyCoefficient = (recency) => {
  if (recency === 'never') return 1.15;
  if (recency === '3_plus_months') return 1.1;
  if (recency === '1_3_months') return 1.05;
  return 1;
};

const getRecencyDurationCoefficient = (recency) => {
  if (recency === 'never') return 1.3;
  if (recency === '3_plus_months') return 1.2;
  if (recency === '1_3_months') return 1.1;
  return 1;
};

const isRecencySensitiveService = (serviceName) => {
  const name = String(serviceName || '').trim().toLowerCase();
  if (!name) return false;

  const fixedDurationPatterns = [
    /когт/,
    /зуб/,
    /уш/,
    /паразит/,
    /парааналь/,
    /гигиен(?!.*стриж)/,
  ];

  if (fixedDurationPatterns.some((pattern) => pattern.test(name))) {
    return false;
  }

  return /груминг|стриж|вычес|линьк|тримминг|spa|спа|мыть|сушк/.test(name);
};

const getAdjustedServiceDuration = (service, recency) => {
  const numeric = Number(service?.durationMinutes);
  const baseDuration = Number.isFinite(numeric) && numeric > 0 ? numeric : 60;
  if (!isRecencySensitiveService(service?.name)) {
    return baseDuration;
  }
  return Math.ceil((baseDuration * getRecencyDurationCoefficient(recency)) / 5) * 5;
};

const getRecencyModifierLabel = (recency) => (
  GROOMING_RECENCY_OPTIONS.find((option) => option.value === recency)?.modifier || 'без надбавки'
);

const SERVICE_CATEGORIES = [
  { id: 'all', label: 'Все', icon: '✦' },
  { id: 'complex', label: 'Комплексы', icon: '★' },
  { id: 'haircut', label: 'Стрижки', icon: '✂' },
  { id: 'coat', label: 'Шерсть', icon: '≈' },
  { id: 'hygiene', label: 'Гигиена', icon: '○' },
  { id: 'spa', label: 'SPA', icon: '◇' },
];

const getServiceCategory = (service) => {
  const name = String(service?.name || '').toLowerCase();
  const description = String(service?.description || '').toLowerCase();
  const text = `${name} ${description}`;

  if (/комплекс|люкс/.test(text)) return 'complex';
  if (/стриж|тримминг/.test(text)) return 'haircut';
  if (/вычес|линьк|колтун|подшерст|шерст/.test(text)) return 'coat';
  if (/spa|спа|маск|массаж|пилинг/.test(text)) return 'spa';
  if (/когт|зуб|уш|глаз|гигиен|паразит|парааналь/.test(text)) return 'hygiene';
  return 'hygiene';
};

const KIND_OPTIONS = ['Собака', 'Кошка'];
const GENDER_OPTIONS = [
  { value: '', label: 'Не указан' },
  { value: 'male', label: 'Самец' },
  { value: 'female', label: 'Самка' },
];

const sanitizeNumber = (value) => value.replace(/\D/g, '');

const getServiceAnimalType = (service) => {
  if (service?.animalType === 'cat' || service?.animalType === 'dog' || service?.animalType === 'all') {
    return service.animalType;
  }
  return 'all';
};

const getStatusMeta = (status) => {
  if (status === 'completed') return { mode: 'positive', label: 'Выполнен' };
  if (status === 'in_progress') return { mode: 'warning', label: 'В процессе' };
  if (status === 'Отменён' || status === 'Отменен' || status === 'Отменена') return { mode: 'negative', label: 'Отменён' };
  return { mode: 'default', label: 'Ожидает' };
};

const isCompletedStatus = (status) => /completed|выполн/i.test(String(status || ''));
const isCancelledStatus = (status) => /отмен/i.test(String(status || ''));

const parseOrderDetails = (services = []) => {
  const noteSource = services.find((service) => service.note)?.note || '';
  const result = {
    lastVisit: '',
    clientComment: '',
    masterComment: '',
  };

  String(noteSource)
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

const PET_SIZE_HELP = {
  dog: 'Собаки: маленький — до 10 кг, средний — 10–25 кг, большой — от 25 кг.',
  cat: 'Кошки: маленький — до 3 кг, средний — 3–5 кг, большой — от 5 кг.',
};

const AVAILABILITY_LOOKAHEAD_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const toValidDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDaysToDateInput = (dateValue, days) => {
  const date = toValidDate(`${dateValue}T00:00:00`);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
};

const getAvailabilityDateRange = (dateValue) => {
  if (!toValidDate(`${dateValue}T00:00:00`)) return [];
  return Array.from({ length: AVAILABILITY_LOOKAHEAD_DAYS }, (_, index) => addDaysToDateInput(dateValue, index));
};

const formatDisplayDate = (value) => {
  const date = toValidDate(value);
  if (!date) return 'Дата не указана';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
};

const formatFullDisplayDate = (value) => {
  const date = toValidDate(value);
  if (!date) return 'Дата не указана';
  return date.toLocaleDateString('ru-RU');
};

const getRelativeDayLabel = (dateValue) => {
  const date = toValidDate(`${dateValue}T00:00:00`);
  if (!date) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / DAY_MS);
  if (diffDays === 0) return 'сегодня';
  if (diffDays === 1) return 'завтра';
  if (diffDays > 1 && diffDays < 7) return `через ${diffDays} дн.`;
  return date.toLocaleDateString('ru-RU', { weekday: 'short' });
};

const getWordForm = (value, forms) => {
  const abs = Math.abs(value) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
};

const formatElapsedFromDate = (dateValue) => {
  const date = toValidDate(dateValue);
  if (!date) return 'дата не определена';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const visitDate = new Date(date);
  visitDate.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.floor((today.getTime() - visitDate.getTime()) / DAY_MS));

  if (days === 0) return 'сегодня';
  if (days < 7) return `${days} ${getWordForm(days, ['день', 'дня', 'дней'])} назад`;
  if (days < 31) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${getWordForm(weeks, ['неделю', 'недели', 'недель'])} назад`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} ${getWordForm(months, ['месяц', 'месяца', 'месяцев'])} назад`;
  }

  const years = Math.floor(days / 365);
  return `${years} ${getWordForm(years, ['год', 'года', 'лет'])} назад`;
};

const getRecencyByDate = (dateValue) => {
  const date = toValidDate(dateValue);
  if (!date) return 'never';
  const daysDiff = Math.floor((Date.now() - date.getTime()) / DAY_MS);
  if (daysDiff <= 30) return 'recent';
  if (daysDiff <= 90) return '1_3_months';
  return '3_plus_months';
};

const getEmployeeLabel = (employee) => {
  const roleName = employee?.roleName || GROOMER_LEVEL_LABELS[employee?.roleId] || '';
  return employee?.displayName || `${employee?.fullName || 'Грумер'}${roleName ? ` · ${roleName}` : ''}`;
};

export const ClientDashboard = ({ id }) => {
  const { logout } = useAuth();
  const routeNavigator = useRouteNavigator();
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [pets, setPets] = useState([]);
  const [services, setServices] = useState([]);
  const [, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [groomingRecency, setGroomingRecency] = useState('recent');
  const [clientComment, setClientComment] = useState('');
  const [serviceCategory, setServiceCategory] = useState('all');
  const [serviceSearch, setServiceSearch] = useState('');
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [availabilityDays, setAvailabilityDays] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [groomingRecencySelectValue, setGroomingRecencySelectValue] = useState('period:recent');
  const preferredSlotRef = useRef({ employeeId: '', time: '' });

  const [newPetName, setNewPetName] = useState('');
  const [newPetKind, setNewPetKind] = useState('Собака');
  const [newPetBreed, setNewPetBreed] = useState('');
  const [newPetAge, setNewPetAge] = useState('');
  const [newPetGender, setNewPetGender] = useState('');
  const [newPetNotes, setNewPetNotes] = useState('');
  const [newPetSize, setNewPetSize] = useState('small');
  const [creatingPet, setCreatingPet] = useState(false);

  const [petEdits, setPetEdits] = useState({});
  const [petSaving, setPetSaving] = useState({});
  const [petDeleting, setPetDeleting] = useState({});
  const [showAddPet, setShowAddPet] = useState(false);
  const [editingPetId, setEditingPetId] = useState('');
  const [activeTab, setActiveTab] = useState('orders');

  const selectedPet = useMemo(() => pets.find((pet) => pet.id === selectedPetId) || null, [pets, selectedPetId]);
  const selectedPetAnimalType = useMemo(() => {
    const kind = String(selectedPet?.kind || '').toLowerCase();
    if (kind.includes('кош')) return 'cat';
    if (kind.includes('соб')) return 'dog';
    return 'all';
  }, [selectedPet]);
  const filteredServices = useMemo(() => {
    if (selectedPetAnimalType === 'all') {
      return services;
    }
    return services.filter((service) => {
      const animalType = getServiceAnimalType(service);
      return animalType === 'all' || animalType === selectedPetAnimalType;
    });
  }, [services, selectedPetAnimalType]);
  const serviceCategoryCounts = useMemo(() => {
    const counts = filteredServices.reduce((acc, service) => {
      const category = getServiceCategory(service);
      acc[category] = (acc[category] || 0) + 1;
      acc.all += 1;
      return acc;
    }, { all: 0 });

    return counts;
  }, [filteredServices]);
  const visibleServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();

    return filteredServices.filter((service) => {
      const matchesCategory = serviceCategory === 'all' || getServiceCategory(service) === serviceCategory;
      const matchesSearch = !query
        || String(service.name || '').toLowerCase().includes(query)
        || String(service.description || '').toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [filteredServices, serviceCategory, serviceSearch]);
  const sizeCoefficient = SIZE_COEFFICIENTS[selectedPet?.size || 'small'] || 1;
  const selectedEmployee = useMemo(
    () => availableEmployees.find((employee) => employee.id === selectedEmployeeId) || null,
    [availableEmployees, selectedEmployeeId],
  );
  const groomerLevelCoefficient = GROOMER_LEVEL_COEFFICIENTS[selectedEmployee?.roleId] || 1;
  const recencyCoefficient = getRecencyCoefficient(groomingRecency);

  const baseServicesTotal = useMemo(() => {
    return selectedServiceIds.reduce((sum, serviceId) => {
      const service = services.find((item) => item.id === serviceId);
      const numeric = Number(service?.price);
      return sum + (Number.isFinite(numeric) ? numeric : 0);
    }, 0);
  }, [services, selectedServiceIds]);

  const totalServicesDuration = useMemo(() => {
    return selectedServiceIds.reduce((sum, serviceId) => {
      const service = services.find((item) => item.id === serviceId);
      return sum + getAdjustedServiceDuration(service, groomingRecency);
    }, 0);
  }, [services, selectedServiceIds, groomingRecency]);

  const finalServicesTotal = baseServicesTotal * sizeCoefficient * recencyCoefficient * groomerLevelCoefficient;

  const canCreateOrder = useMemo(
    () => Boolean(selectedPetId && selectedServiceIds.length > 0 && selectedEmployeeId && selectedDate && selectedTime),
    [selectedPetId, selectedServiceIds, selectedEmployeeId, selectedDate, selectedTime],
  );

  const completedPetVisitHistory = useMemo(() => {
    if (!selectedPetId || orders.length === 0) {
      return [];
    }

    const visits = new Map();

    orders.forEach((order) => {
      const orderId = order['Код_заказа'];
      const petId = order['Код_груминг_клиента'];
      const visitDate = order.serviceStart;
      if (!orderId || petId !== selectedPetId || !visitDate || !isCompletedStatus(order.serviceStatus)) {
        return;
      }

      if (!visits.has(orderId)) {
        visits.set(orderId, {
          id: orderId,
          date: visitDate,
          employeeName: order.employeeName || '',
          services: [],
        });
      }

      const entry = visits.get(orderId);
      if (order.serviceName && !entry.services.includes(order.serviceName)) {
        entry.services.push(order.serviceName);
      }
      if (!entry.employeeName && order.employeeName) {
        entry.employeeName = order.employeeName;
      }
    });

    return Array.from(visits.values())
      .map((visit) => ({
        ...visit,
        dateLabel: formatFullDisplayDate(visit.date),
        elapsedLabel: formatElapsedFromDate(visit.date),
        recency: getRecencyByDate(visit.date),
        servicesLabel: visit.services.length > 0 ? visit.services.join(', ') : 'Груминг',
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, selectedPetId]);

  const latestCompletedVisit = completedPetVisitHistory[0] || null;
  const selectedAvailabilityDay = useMemo(
    () => availabilityDays.find((day) => day.date === selectedDate) || null,
    [availabilityDays, selectedDate],
  );
  const firstAvailableDay = useMemo(
    () => availabilityDays.find((day) => day.totalSlots > 0) || null,
    [availabilityDays],
  );

  const loadClientData = async () => {
    const [profileResult, ordersResult, petsResult, servicesResult, employeesResult] = await Promise.allSettled([
      clientApi.getProfile(),
      clientApi.getOrders(),
      petsApi.getMyPets(),
      servicesApi.getAll(),
      employeesApi.getAllForAssignment(),
    ]);

    const failedMessages = [];

    if (profileResult.status === 'fulfilled') {
      setProfile(profileResult.value);
    } else {
      failedMessages.push(`profile: ${profileResult.reason?.message || 'failed'}`);
      console.error('Profile loading failed:', profileResult.reason?.data || profileResult.reason);
    }

    if (ordersResult.status === 'fulfilled') {
      setOrders(ordersResult.value);
    } else {
      failedMessages.push(`orders: ${ordersResult.reason?.message || 'failed'}`);
      console.error('Orders loading failed:', ordersResult.reason?.data || ordersResult.reason);
    }

    if (petsResult.status === 'fulfilled') {
      setPets(petsResult.value);
      if (!selectedPetId && petsResult.value.length > 0) {
        setSelectedPetId(petsResult.value[0].id);
      }
    } else {
      failedMessages.push(`pets: ${petsResult.reason?.message || 'failed'}`);
      console.error('Pets loading failed:', petsResult.reason?.data || petsResult.reason);
    }

    if (servicesResult.status === 'fulfilled') {
      setServices(servicesResult.value);
      if (selectedServiceIds.length === 0 && servicesResult.value.length > 0) {
        setSelectedServiceIds([servicesResult.value[0].id]);
      }
    } else {
      failedMessages.push(`services: ${servicesResult.reason?.message || 'failed'}`);
      console.error('Services loading failed:', servicesResult.reason?.data || servicesResult.reason);
    }

    if (employeesResult.status === 'fulfilled') {
      setEmployees(employeesResult.value);
      if (!selectedEmployeeId && employeesResult.value.length > 0) {
        setSelectedEmployeeId(employeesResult.value[0].id);
      }
    } else {
      failedMessages.push(`employees: ${employeesResult.reason?.message || 'failed'}`);
      console.error('Employees loading failed:', employeesResult.reason?.data || employeesResult.reason);
    }

    if (failedMessages.length > 0) {
      setErrorMessage(`Часть данных не загружена: ${failedMessages.join('; ')}`);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await loadClientData();
      } catch (error) {
        console.error('Error fetching client data:', error);
        setErrorMessage('Не удалось загрузить данные');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    setPetEdits((prev) => {
      const next = { ...prev };
      pets.forEach((pet) => {
        if (!next[pet.id]) {
          next[pet.id] = {
            name: pet.name || '',
            kind: pet.kind || '',
            breed: pet.breed || '',
            age: pet.age ?? '',
            gender: pet.gender || '',
            notes: pet.notes || '',
            size: pet.size || 'small',
          };
        }
      });
      return next;
    });
  }, [pets]);

  useEffect(() => {
    if (pets.length === 0) {
      if (selectedPetId) {
        setSelectedPetId('');
      }
      return;
    }

    const hasSelectedPet = pets.some((pet) => pet.id === selectedPetId);
    if (!hasSelectedPet) {
      setSelectedPetId(pets[0].id);
    }
  }, [pets, selectedPetId]);

  const refreshAvailability = useCallback(async (dateValue, serviceIdsValue) => {
    if (!dateValue || serviceIdsValue.length === 0) {
      setAvailableEmployees([]);
      setAvailabilityDays([]);
      setSelectedEmployeeId('');
      setSelectedTime('');
      return;
    }

    setAvailabilityLoading(true);
    setAvailabilityMessage('');

    try {
      const dates = getAvailabilityDateRange(dateValue);
      const days = await Promise.all(dates.map(async (dayDate) => {
        try {
          const availability = await clientApi.getAvailability({
            date: dayDate,
            serviceIds: serviceIdsValue,
            groomingRecency,
          });
          const employeesForDay = availability.employees || [];
          const totalSlots = employeesForDay.reduce((sum, employee) => sum + (employee.slots?.length || 0), 0);

          return {
            date: dayDate,
            durationMinutes: availability.durationMinutes || totalServicesDuration,
            employees: employeesForDay,
            totalSlots,
            failed: false,
          };
        } catch (error) {
          console.error('Error fetching availability day:', dayDate, error);
          return {
            date: dayDate,
            durationMinutes: totalServicesDuration,
            employees: [],
            totalSlots: 0,
            failed: true,
          };
        }
      }));

      setAvailabilityDays(days);

      const requestedDay = days.find((day) => day.date === dateValue);
      const dayToUse = requestedDay?.totalSlots > 0
        ? requestedDay
        : days.find((day) => day.totalSlots > 0);

      if (!dayToUse) {
        setAvailableEmployees([]);
        setSelectedEmployeeId('');
        setSelectedTime('');
        setAvailabilityMessage(`Свободных слотов на ближайшие ${AVAILABILITY_LOOKAHEAD_DAYS} дней не найдено`);
        return;
      }

      setAvailableEmployees(dayToUse.employees || []);

      if (dayToUse.date !== dateValue) {
        setAvailabilityMessage(`На ${formatDisplayDate(dateValue)} свободных слотов нет. Ближайшие варианты найдены на ${formatDisplayDate(dayToUse.date)}.`);
        setSelectedDate(dayToUse.date);
      } else {
        setAvailabilityMessage('');
      }

      const preferred = preferredSlotRef.current || {};
      const preferredEmployee = (dayToUse.employees || []).find(
        (employee) => employee.id === preferred.employeeId && (employee.slots || []).includes(preferred.time),
      );
      const firstEmployeeWithSlot = preferredEmployee
        || (dayToUse.employees || []).find((employee) => (employee.slots || []).length > 0);

      if (firstEmployeeWithSlot) {
        const nextTime = preferredEmployee ? preferred.time : firstEmployeeWithSlot.slots[0];
        preferredSlotRef.current = { employeeId: firstEmployeeWithSlot.id, time: nextTime };
        setSelectedEmployeeId(firstEmployeeWithSlot.id);
        setSelectedTime(nextTime || '');
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      setAvailabilityMessage('Не удалось загрузить доступные слоты');
    } finally {
      setAvailabilityLoading(false);
    }
  }, [groomingRecency, totalServicesDuration]);

  useEffect(() => {
    refreshAvailability(selectedDate, selectedServiceIds);
  }, [selectedDate, selectedServiceIds, groomingRecency, refreshAvailability]);

  useEffect(() => {
    const filteredIds = new Set(filteredServices.map((service) => service.id));
    setSelectedServiceIds((prev) => {
      const next = prev.filter((id) => filteredIds.has(id));
      if (next.length > 0) {
        return next;
      }
      if (filteredServices.length > 0) {
        return [filteredServices[0].id];
      }
      return [];
    });
  }, [filteredServices]);

  useEffect(() => {
    if (serviceCategory !== 'all' && !serviceCategoryCounts[serviceCategory]) {
      setServiceCategory('all');
    }
  }, [serviceCategory, serviceCategoryCounts]);

  useEffect(() => {
    if (!selectedPetId) {
      return;
    }

    if (!latestCompletedVisit) {
      setGroomingRecency('never');
      setGroomingRecencySelectValue('period:never');
      return;
    }

    setGroomingRecency(latestCompletedVisit.recency);
    setGroomingRecencySelectValue(`history:${latestCompletedVisit.id}`);
  }, [selectedPetId, latestCompletedVisit]);

  const handleRecencyChange = (value) => {
    setGroomingRecencySelectValue(value);

    if (value.startsWith('history:')) {
      const visitId = value.replace('history:', '');
      const visit = completedPetVisitHistory.find((item) => item.id === visitId);
      setGroomingRecency(visit?.recency || 'recent');
      return;
    }

    setGroomingRecency(value.replace('period:', '') || 'recent');
  };

  const handleDateChange = (value) => {
    preferredSlotRef.current = { employeeId: '', time: '' };
    setSelectedDate(value);
  };

  const handleAvailabilitySlotSelect = (day, employee, slot) => {
    preferredSlotRef.current = { employeeId: employee.id, time: slot };
    setSelectedDate(day.date);
    setAvailableEmployees(day.employees || []);
    setSelectedEmployeeId(employee.id);
    setSelectedTime(slot);
    setAvailabilityMessage('');
  };

  const handleEmployeeChange = (value) => {
    const employee = availableEmployees.find((item) => item.id === value);
    const nextTime = employee?.slots?.[0] || '';
    preferredSlotRef.current = { employeeId: value, time: nextTime };
    setSelectedEmployeeId(value);
    setSelectedTime(nextTime);
  };

  const handleTimeChange = (value) => {
    preferredSlotRef.current = { employeeId: selectedEmployeeId, time: value };
    setSelectedTime(value);
  };

  const handleCreateOrder = async () => {
    if (!canCreateOrder || creatingOrder) return;

    setCreatingOrder(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await clientApi.createOrder({
        petId: selectedPetId,
        serviceIds: selectedServiceIds,
        employeeId: selectedEmployeeId,
        date: selectedDate,
        time: selectedTime,
        groomingRecency,
        clientComment: clientComment.trim() || null,
      });

      const ordersData = await clientApi.getOrders();
      setOrders(ordersData);
      await refreshAvailability(selectedDate, selectedServiceIds);
      setSelectedPetId(pets[0]?.id || '');
      setSelectedEmployeeId('');
      setSelectedServiceIds(filteredServices[0]?.id ? [filteredServices[0].id] : []);
      setSelectedDate('');
      setSelectedTime('');
      setGroomingRecency('recent');
      setGroomingRecencySelectValue('period:recent');
      setClientComment('');
      setAvailabilityDays([]);
      preferredSlotRef.current = { employeeId: '', time: '' };
      setSuccessMessage('Запись успешно оформлена');
    } catch (error) {
      console.error('Error creating order:', error);
      setErrorMessage('Не удалось создать заказ');
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Отменить заказ?')) return;
    setErrorMessage('');

    try {
      await clientApi.deleteOrder(orderId);
      const ordersData = await clientApi.getOrders();
      setOrders(ordersData);
      await refreshAvailability(selectedDate, selectedServiceIds);
    } catch (error) {
      console.error('Error deleting order:', error);
      setErrorMessage('Не удалось удалить заказ');
    }
  };

  const handleCreatePet = async () => {
    if (!newPetName || creatingPet) return;

    setCreatingPet(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await petsApi.createPet({
        petName: newPetName,
        kind: newPetKind,
        breed: newPetBreed,
        age: newPetAge ? Number(newPetAge) : null,
        gender: newPetGender,
        notes: newPetNotes,
        size: newPetSize,
      });

      const petsData = await petsApi.getMyPets();
      setPets(petsData);
      setEditingPetId('');
      if (result?.petId) {
        setSelectedPetId(result.petId);
      }
      setNewPetName('');
      setNewPetKind('Собака');
      setNewPetBreed('');
      setNewPetAge('');
      setNewPetGender('');
      setNewPetNotes('');
      setNewPetSize('small');
      setShowAddPet(false);
    } catch (error) {
      console.error('Error creating pet:', error);
      setErrorMessage('Не удалось добавить питомца');
    } finally {
      setCreatingPet(false);
    }
  };

  const handlePetFieldChange = (petId, field, value) => {
    setPetEdits((prev) => ({
      ...prev,
      [petId]: {
        ...prev[petId],
        [field]: value,
      },
    }));
  };

  const handleSavePet = async (petId) => {
    const payload = petEdits[petId];
    if (!payload?.name || petSaving[petId]) return;

    setPetSaving((prev) => ({ ...prev, [petId]: true }));
    setErrorMessage('');

    try {
      await petsApi.updatePet(petId, {
        petName: payload.name,
        kind: payload.kind,
        breed: payload.breed,
        age: payload.age ? Number(payload.age) : null,
        gender: payload.gender,
        notes: payload.notes,
        size: payload.size,
      });

      const petsData = await petsApi.getMyPets();
      setPets(petsData);
    } catch (error) {
      console.error('Error updating pet:', error);
      setErrorMessage('Не удалось сохранить питомца');
    } finally {
      setPetSaving((prev) => ({ ...prev, [petId]: false }));
    }
  };

  const handleDeletePet = async (petId) => {
    if (petDeleting[petId]) return;
    if (!window.confirm('Удалить питомца?')) return;

    setPetDeleting((prev) => ({ ...prev, [petId]: true }));
    setErrorMessage('');

    try {
      await petsApi.deletePet(petId);
      const petsData = await petsApi.getMyPets();
      setPets(petsData);
      setSelectedPetId((prev) => (prev === petId ? '' : prev));
      setEditingPetId((prev) => (prev === petId ? '' : prev));
    } catch (error) {
      console.error('Error deleting pet:', error);
      setErrorMessage('Не удалось удалить питомца');
    } finally {
      setPetDeleting((prev) => ({ ...prev, [petId]: false }));
    }
  };

  const groupedOrders = useMemo(() => {
    const map = new Map();

    for (const order of orders) {
      const orderId = order['Код_заказа'];
      if (!orderId) continue;

      if (!map.has(orderId)) {
        map.set(orderId, {
          id: orderId,
          status: order.serviceStatus,
          date: order['Дата_заказа'],
          startTime: order.serviceStart,
          endTime: order.serviceEnd,
          employeeName: order.employeeName,
          petName: order.petName,
          petKind: order.petKind,
          petBreed: order.petBreed,
          petSize: order.petSize,
          services: [],
          totalPrice: order['Стоимость_оказания_услуг'],
          summedServicePrice: 0,
          duration: 0,
        });
      }

      const entry = map.get(orderId);
      entry.services.push({
        name: order.serviceName,
        price: order.servicePrice,
        duration: order.serviceDuration,
        note: order.note,
      });
      entry.summedServicePrice += Number(order.servicePrice) || 0;
      entry.duration += Number(order.serviceDuration) || 0;

      if (!entry.employeeName && order.employeeName) {
        entry.employeeName = order.employeeName;
      }

      if (!entry.status && order.serviceStatus) {
        entry.status = order.serviceStatus;
      }

      if (!entry.startTime && order.serviceStart) {
        entry.startTime = order.serviceStart;
      }

      if (!entry.endTime && order.serviceEnd) {
        entry.endTime = order.serviceEnd;
      }

    }

    return Array.from(map.values()).map((entry) => {
      const start = entry.startTime ? new Date(entry.startTime) : null;
      const end = entry.endTime ? new Date(entry.endTime) : null;
      const actualDuration = start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
        ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
        : entry.duration;

      return {
        ...entry,
        details: parseOrderDetails(entry.services),
        duration: actualDuration,
        totalPrice: Number.isFinite(Number(entry.totalPrice)) ? Number(entry.totalPrice) : entry.summedServicePrice,
      };
    });
  }, [orders]);

  const slotsForSelectedEmployee = useMemo(() => {
    const employee = availableEmployees.find((item) => item.id === selectedEmployeeId);
    return employee?.slots || [];
  }, [availableEmployees, selectedEmployeeId]);

  useEffect(() => {
    if (selectedTime && slotsForSelectedEmployee.length > 0 && !slotsForSelectedEmployee.includes(selectedTime)) {
      const nextTime = slotsForSelectedEmployee[0] || '';
      preferredSlotRef.current = { employeeId: selectedEmployeeId, time: nextTime };
      setSelectedTime(nextTime);
    }
    if (slotsForSelectedEmployee.length === 0) {
      preferredSlotRef.current = { employeeId: selectedEmployeeId, time: '' };
      setSelectedTime('');
    }
  }, [selectedEmployeeId, selectedTime, slotsForSelectedEmployee]);

  return (
    <Panel id={id} className="client-dashboard">
      <PanelHeader
        after={(
          <div className="cd-header-buttons">
            <Button
              mode="secondary"
              size="s"
              className="cd-header-role-button"
              onClick={() => routeNavigator.push('/role-menu')}
            >
              <span className="cd-header-text-full">Выбор роли</span>
              <span className="cd-header-text-mobile">Роль</span>
            </Button>
            <Button
              mode="tertiary"
              size="s"
              className="cd-header-exit-button"
              onClick={logout}
            >
              <span className="cd-header-text-full">Выйти</span>
              <span className="cd-header-text-mobile">Выход</span>
            </Button>
          </div>
        )}
      >
        <span className="cd-panel-title-full">Пёс Пижон · Личный кабинет</span>
        <span className="cd-panel-title-mobile">Пёс Пижон · Личный кабинет</span>
      </PanelHeader>

      {loading ? (
        <div className="cd-loading">
          <div className="cd-spinner" />
        </div>
      ) : (
        <div className="cd-page">
          <div
            className="cd-client-actions-shell"
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: 'min(1120px, calc(100vw - 32px))',
              maxWidth: '1120px',
              margin: '42px auto 18px',
              padding: 0,
              boxSizing: 'border-box',
            }}
          >
            <div
              className="cd-client-actions"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '10px',
                width: '100%',
                maxWidth: '100%',
                margin: 0,
                padding: 0,
                boxSizing: 'border-box',
              }}
            >
              <Button
                mode="secondary"
                size="m"
                className="cd-client-action-button cd-client-role-button"
                style={{ width: '100%' }}
                onClick={() => routeNavigator.push('/role-menu')}
              >
                Выбор роли
              </Button>
              <Button
                mode="tertiary"
                size="m"
                className="cd-client-action-button cd-client-exit-button"
                style={{ width: '100%' }}
                onClick={logout}
              >
                Выйти
              </Button>
            </div>
          </div>

          <section className="cd-hero">
            <div>
              <div className="cd-hero-kicker">Пёс Пижон</div>
              <div className="cd-hero-title">Первый груминг-салон в Петрозаводске</div>
              <div className="cd-hero-subtitle">
                Выбирайте услуги, смотрите доступные слоты и управляйте заказами в одном месте.
              </div>
            </div>
            <div className="cd-hero-stats">
              <div className="cd-stat">
                <div className="cd-stat-label">Питомцы</div>
                <div className="cd-stat-value">{pets.length}</div>
              </div>
              <div className="cd-stat">
                <div className="cd-stat-label">Активные</div>
                <div className="cd-stat-value">
                  {groupedOrders.filter((order) => !isCancelledStatus(order.status) && !isCompletedStatus(order.status)).length}
                </div>
              </div>
              <div className="cd-stat">
                <div className="cd-stat-label">Всего заказов</div>
                <div className="cd-stat-value">{groupedOrders.length}</div>
              </div>
            </div>
          </section>

          {errorMessage ? <div className="cd-alert">{errorMessage}</div> : null}
          {successMessage ? <div className="cd-alert">{successMessage}</div> : null}
          {profile && (
            <Group className="cd-group" header={<Header mode="secondary">Профиль 👤</Header>}>
              <div className="cd-profile-card">
                <Avatar size={48} initials={profile['ФИО']?.charAt(0) || 'К'} />
                <div className="cd-profile-info">
                  <div className="cd-profile-name">{profile['ФИО'] || 'Клиент'}</div>
                  <div className="cd-profile-phone">{profile['Номер_телефона'] || 'Телефон не указан'}</div>
                </div>
              </div>
            </Group>
          )}

          <Group className="cd-group" header={<Header mode="secondary">Управление 🧭</Header>}>
            <Tabs className="cd-tabs">
              <TabsItem
                className={`cd-tab-item${activeTab === 'orders' ? ' cd-tab-item-active' : ''}`}
                selected={activeTab === 'orders'}
                onClick={() => setActiveTab('orders')}
              >
                Запись
              </TabsItem>
              <TabsItem
                className={`cd-tab-item${activeTab === 'pets' ? ' cd-tab-item-active' : ''}`}
                selected={activeTab === 'pets'}
                onClick={() => setActiveTab('pets')}
              >
                Питомцы
              </TabsItem>
              <TabsItem
                className={`cd-tab-item${activeTab === 'history' ? ' cd-tab-item-active' : ''}`}
                selected={activeTab === 'history'}
                onClick={() => setActiveTab('history')}
              >
                Мои заказы
              </TabsItem>
            </Tabs>
          </Group>

          {activeTab === 'pets' ? (
          <Group
            className="cd-group"
            header={
              <Header mode="secondary">
                <div className="cd-header-row">
                  <span>Питомцы 🐾</span>
                  <div
                    role="button"
                    tabIndex={0}
                    className="cd-add-pet-button"
                    onClick={() => setShowAddPet((prev) => !prev)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setShowAddPet((prev) => !prev);
                      }
                    }}
                  >
                    {showAddPet ? 'Скрыть форму' : 'Добавить'}
                  </div>
                </div>
              </Header>
            }
          >
            {pets.length > 0 ? (
              pets.map((pet) => {
                const edit = petEdits[pet.id] || {};
                const sizeLabel = SIZE_LABELS[pet.size] ? ` · ${SIZE_LABELS[pet.size]}` : '';
                const isEditing = editingPetId === pet.id;

                return (
                  <CardGrid key={pet.id} size="l">
                    <Card mode="shadow" className="cd-card cd-pet-card">
                      <SimpleCell
                        before={<Avatar size={48} initials={pet.name?.charAt(0) || 'П'} />}
                        description={`${pet.breed || 'Порода не указана'}${pet.age ? ` · ${pet.age} лет` : ''}${sizeLabel}`}
                        className="cd-simplecell cd-pet-head"
                        after={
                          <Button
                            size="s"
                            mode="secondary"
                            className="cd-edit-pet-button"
                            onClick={() => setEditingPetId(isEditing ? '' : pet.id)}
                          >
                            {isEditing ? 'Свернуть' : 'Редактировать'}
                          </Button>
                        }
                      >
                        {pet.name || 'Питомец'}
                      </SimpleCell>

                      {isEditing ? (
                      <div className="cd-card-body">
                        <FormItem top="Имя питомца">
                          <Input
                            value={edit.name ?? ''}
                            onChange={(e) => handlePetFieldChange(pet.id, 'name', e.target.value)}
                          />
                        </FormItem>
                        <FormItem top="Вид">
                          <Input
                            value={edit.kind ?? ''}
                            onChange={(e) => handlePetFieldChange(pet.id, 'kind', e.target.value)}
                          />
                        </FormItem>
                        <FormItem top="Порода">
                          <Input
                            value={edit.breed ?? ''}
                            onChange={(e) => handlePetFieldChange(pet.id, 'breed', e.target.value)}
                          />
                        </FormItem>
                        <FormItem top="Возраст">
                          <Input
                            type="number"
                            value={edit.age ?? ''}
                            onChange={(e) => handlePetFieldChange(pet.id, 'age', sanitizeNumber(e.target.value))}
                          />
                        </FormItem>
                        <FormItem top="Пол">
                          <NativeSelect
                            value={edit.gender ?? ''}
                            onChange={(e) => handlePetFieldChange(pet.id, 'gender', e.target.value)}
                          >
                            {GENDER_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </NativeSelect>
                        </FormItem>
                        <FormItem top="Размер">
                          <NativeSelect
                            value={edit.size || 'small'}
                            onChange={(e) => handlePetFieldChange(pet.id, 'size', e.target.value)}
                          >
                            <option value="small">Маленький</option>
                            <option value="medium">Средний</option>
                            <option value="large">Большой</option>
                          </NativeSelect>
                          <div className="cd-size-help">
                            {String(edit.kind || pet.kind || '').toLowerCase().includes('кош')
                              ? PET_SIZE_HELP.cat
                              : PET_SIZE_HELP.dog}
                          </div>
                        </FormItem>
                        <FormItem top="Особые отметки">
                          <Textarea
                            value={edit.notes ?? ''}
                            onChange={(e) => handlePetFieldChange(pet.id, 'notes', e.target.value)}
                          />
                        </FormItem>
                        <FormItem>
                          <div className="cd-action-row">
                            <Button
                              size="m"
                              mode="secondary"
                              onClick={() => handleSavePet(pet.id)}
                              disabled={!edit.name || petSaving[pet.id]}
                            >
                              {petSaving[pet.id] ? 'Сохранение...' : 'Сохранить'}
                            </Button>
                            <Button
                              size="m"
                              mode="destructive"
                              onClick={() => handleDeletePet(pet.id)}
                              disabled={petDeleting[pet.id]}
                            >
                              {petDeleting[pet.id] ? 'Удаление...' : 'Удалить'}
                            </Button>
                          </div>
                        </FormItem>
                      </div>
                      ) : null}
                    </Card>
                  </CardGrid>
                );
              })
            ) : (
              <div className="cd-empty">У вас пока нет питомцев</div>
            )}

            {showAddPet ? (
            <div className="cd-subsection cd-subsection-add">
              <div className="cd-subsection-title">Новый питомец</div>
              <FormItem top="Имя питомца">
                <Input
                  value={newPetName}
                  onChange={(e) => setNewPetName(e.target.value)}
                  placeholder="Например, Барсик"
                />
              </FormItem>
              <FormItem top="Вид">
                <NativeSelect value={newPetKind} onChange={(e) => setNewPetKind(e.target.value)}>
                  {KIND_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </NativeSelect>
              </FormItem>
              <FormItem top="Порода">
                <Input
                  value={newPetBreed}
                  onChange={(e) => setNewPetBreed(e.target.value)}
                  placeholder="Например, шпиц"
                />
              </FormItem>
              <FormItem top="Возраст">
                <Input
                  type="number"
                  value={newPetAge}
                  onChange={(e) => setNewPetAge(sanitizeNumber(e.target.value))}
                  placeholder="Возраст в годах"
                />
              </FormItem>
              <FormItem top="Пол">
                <NativeSelect value={newPetGender} onChange={(e) => setNewPetGender(e.target.value)}>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </FormItem>
              <FormItem top="Размер">
                <NativeSelect value={newPetSize} onChange={(e) => setNewPetSize(e.target.value)}>
                  <option value="small">Маленький</option>
                  <option value="medium">Средний</option>
                  <option value="large">Большой</option>
                </NativeSelect>
                <div className="cd-size-help">
                  {String(newPetKind || '').toLowerCase().includes('кош')
                    ? PET_SIZE_HELP.cat
                    : PET_SIZE_HELP.dog}
                </div>
              </FormItem>
              <FormItem top="Особые отметки">
                <Textarea
                  value={newPetNotes}
                  onChange={(e) => setNewPetNotes(e.target.value)}
                  placeholder="Например, боится фена"
                />
              </FormItem>
              <FormItem>
                <Button
                  size="l"
                  stretched
                  className="cd-submit-pet-button"
                  onClick={handleCreatePet}
                  disabled={!newPetName || creatingPet}
                >
                  {creatingPet ? 'Добавление...' : 'Добавить питомца'}
                </Button>
              </FormItem>
            </div>
            ) : null}
          </Group>
          ) : null}

          {activeTab === 'orders' ? (
          <Group className="cd-group" header={<Header mode="secondary">Создать заказ ✂️</Header>}>
            <div className="cd-field">
              <div className="cd-field-label">Питомец</div>
              <NativeSelect value={selectedPetId} onChange={(e) => setSelectedPetId(e.target.value)} disabled={pets.length === 0}>
                {pets.length === 0 ? (
                  <option value="">Нет питомцев</option>
                ) : (
                  pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))
                )}
              </NativeSelect>
            </div>

            {selectedPet ? (
              <div className="cd-field cd-field-info">
                Размер питомца: {SIZE_LABELS[selectedPet.size || 'small']} · {getSizeModifierLabel(selectedPet.size || 'small')}
              </div>
            ) : null}

            <div className="cd-field">
              <div className="cd-field-label">Когда были на груминге в последний раз</div>
              <NativeSelect value={groomingRecencySelectValue} onChange={(e) => handleRecencyChange(e.target.value)}>
                {GROOMING_RECENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={`period:${option.value}`}>
                    {option.label}
                    {latestCompletedVisit?.recency === option.value
                      ? ` (последняя: ${latestCompletedVisit.dateLabel}, ${latestCompletedVisit.elapsedLabel})`
                      : ''}
                  </option>
                ))}
                {completedPetVisitHistory.length > 0 ? (
                  <optgroup label="Выполненные записи этого питомца">
                    {completedPetVisitHistory.map((visit) => (
                      <option key={visit.id} value={`history:${visit.id}`}>
                        {visit.dateLabel} · {visit.servicesLabel} ({visit.elapsedLabel})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </NativeSelect>
            </div>

            <div className="cd-field cd-field-info">
              Последний груминг: {getRecencyModifierLabel(groomingRecency)}
              {latestCompletedVisit
                ? ` · найдено по истории: ${latestCompletedVisit.dateLabel}, ${latestCompletedVisit.elapsedLabel}`
                : ' · выполненных записей для питомца пока нет'}
            </div>

            <div className="cd-field">
              <div className="cd-field-label">Услуги</div>
              {filteredServices.length === 0 ? (
                <div className="cd-empty">Нет услуг</div>
              ) : (
                <div className="cd-service-picker">
                  <div className="cd-service-picker-head">
                    <div>
                      <div className="cd-service-picker-title">Выберите услуги</div>
                      <div className="cd-service-picker-subtitle">
                        Можно выбрать несколько услуг. Время пересчитается автоматически.
                      </div>
                    </div>
                    <Badge mode="new">{selectedServiceIds.length}</Badge>
                  </div>

                  <Input
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Найти услугу по названию"
                    className="cd-service-search"
                  />

                  <div className="cd-category-scroll">
                    {SERVICE_CATEGORIES.filter((category) => category.id === 'all' || serviceCategoryCounts[category.id]).map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className={`cd-category-chip${serviceCategory === category.id ? ' cd-category-chip-active' : ''}`}
                        onClick={() => setServiceCategory(category.id)}
                      >
                        <span className="cd-category-icon">{category.icon}</span>
                        <span>{category.label}</span>
                        <span className="cd-category-count">{serviceCategoryCounts[category.id] || 0}</span>
                      </button>
                    ))}
                  </div>

                  {visibleServices.length === 0 ? (
                    <div className="cd-empty">По выбранному фильтру услуг нет</div>
                  ) : null}

                  <div className="cd-service-list">
                  {visibleServices.map((service) => {
                    const isChecked = selectedServiceIds.includes(service.id);
                    const numericPrice = Number(service.price);
                    const priceLabel = Number.isFinite(numericPrice) ? `${numericPrice} ₽` : 'Цена не указана';
                    const baseDuration = Number.isFinite(Number(service.durationMinutes))
                      ? Number(service.durationMinutes)
                      : 60;
                    const adjustedDuration = getAdjustedServiceDuration(service, groomingRecency);
                    const durationLabel = adjustedDuration !== baseDuration
                      ? `${adjustedDuration} мин с учётом давности`
                      : `${baseDuration} мин`;
                    const category = SERVICE_CATEGORIES.find((item) => item.id === getServiceCategory(service));

                    return (
                      <button
                        key={service.id}
                        type="button"
                        className={`cd-service-row${isChecked ? ' cd-service-row-selected' : ''}`}
                        onClick={() =>
                          setSelectedServiceIds((prev) =>
                            isChecked ? prev.filter((id) => id !== service.id) : [...prev, service.id],
                          )
                        }
                      >
                        <span className="cd-service-check">{isChecked ? '✓' : '+'}</span>
                        <span className="cd-service-main">
                          <span className="cd-service-title-row">
                            <span className="cd-service-name">{service.name}</span>
                            <span className="cd-service-category">{category?.label || 'Услуга'}</span>
                          </span>
                          {service.description ? (
                            <span className="cd-service-desc">
                              {service.description}
                            </span>
                          ) : null}
                        </span>
                        <span className="cd-service-meta">
                          <span>{priceLabel}</span>
                          <span>{durationLabel}</span>
                        </span>
                      </button>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>

            <div className="cd-hint cd-note-box">
              У услуги указаны базовая цена и базовое время. Финальная стоимость рассчитывается с учётом размера питомца, давности последнего визита и уровня выбранного грумера. Время увеличивается по давности только для услуг, зависящих от состояния шерсти.
            </div>

            <div className="cd-field">
              <div className="cd-field-label">Дата заказа</div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="cd-date-input"
              />
            </div>

            {availabilityMessage ? <SimpleCell>{availabilityMessage}</SimpleCell> : null}

            {selectedDate && selectedServiceIds.length > 0 ? (
              <div className="cd-field cd-availability-field">
                <div className="cd-availability-head">
                  <div>
                    <div className="cd-field-label">Ближайшие доступные записи</div>
                    <div className="cd-availability-subtitle">
                      {availabilityLoading
                        ? 'Проверяем расписание на ближайшие дни...'
                        : firstAvailableDay
                          ? `Нашли ${firstAvailableDay.totalSlots} слотов на ближайшую подходящую дату. Длительность услуги: ${selectedAvailabilityDay?.durationMinutes || totalServicesDuration} мин.`
                          : `Свободные окна появятся здесь после проверки ${AVAILABILITY_LOOKAHEAD_DAYS} дней.`}
                    </div>
                  </div>
                  {selectedDate ? (
                    <Badge mode={firstAvailableDay ? 'new' : 'default'}>
                      {firstAvailableDay ? `${formatDisplayDate(firstAvailableDay.date)}` : 'нет слотов'}
                    </Badge>
                  ) : null}
                </div>

                {availabilityDays.length > 0 ? (
                  <div className="cd-availability-days">
                    {availabilityDays.map((day) => (
                      <button
                        key={day.date}
                        type="button"
                        className={`cd-availability-day${day.date === selectedDate ? ' cd-availability-day-active' : ''}${day.totalSlots === 0 ? ' cd-availability-day-empty' : ''}`}
                        onClick={() => {
                          if (day.totalSlots === 0) return;
                          const firstEmployee = day.employees.find((employee) => (employee.slots || []).length > 0);
                          const firstSlot = firstEmployee?.slots?.[0];
                          if (firstEmployee && firstSlot) {
                            handleAvailabilitySlotSelect(day, firstEmployee, firstSlot);
                          }
                        }}
                        disabled={day.totalSlots === 0}
                      >
                        <span>{formatDisplayDate(day.date)}</span>
                        <small>{getRelativeDayLabel(day.date)}</small>
                        <strong>{day.totalSlots > 0 ? `${day.totalSlots} сл.` : 'нет'}</strong>
                      </button>
                    ))}
                  </div>
                ) : null}

                {availabilityLoading ? (
                  <div className="cd-availability-empty">Ищем свободные окна у всех грумеров</div>
                ) : availabilityDays.some((day) => day.totalSlots > 0) ? (
                  <div className="cd-availability-list">
                    {availabilityDays
                      .filter((day) => day.totalSlots > 0)
                      .map((day) => (
                        <div key={day.date} className="cd-availability-date-card">
                          <div className="cd-availability-date-title">
                            <span>{formatDisplayDate(day.date)}</span>
                            <small>{getRelativeDayLabel(day.date)}</small>
                          </div>
                          <div className="cd-availability-employees">
                            {day.employees
                              .filter((employee) => (employee.slots || []).length > 0)
                              .map((employee) => (
                                <div key={`${day.date}-${employee.id}`} className="cd-availability-employee">
                                  <div className="cd-availability-employee-name">
                                    {getEmployeeLabel(employee)}
                                    {employee.roleId ? (
                                      <span>{getGroomerModifierLabel(employee.roleId)}</span>
                                    ) : null}
                                  </div>
                                  <div className="cd-availability-slots">
                                    {employee.slots.map((slot) => {
                                      const isSelected = day.date === selectedDate
                                        && employee.id === selectedEmployeeId
                                        && slot === selectedTime;

                                      return (
                                        <button
                                          key={`${day.date}-${employee.id}-${slot}`}
                                          type="button"
                                          className={`cd-slot-button${isSelected ? ' cd-slot-button-active' : ''}`}
                                          onClick={() => handleAvailabilitySlotSelect(day, employee, slot)}
                                        >
                                          {slot}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="cd-availability-empty">Свободных окон на ближайшие дни нет</div>
                )}
              </div>
            ) : null}

            <div className="cd-field">
              <div className="cd-field-label">Грумер</div>
              <NativeSelect
                value={selectedEmployeeId}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                disabled={availabilityLoading || availableEmployees.length === 0}
              >
                {availabilityLoading ? (
                  <option value="">Загрузка...</option>
                ) : availableEmployees.length === 0 ? (
                  <option value="">Нет доступных</option>
                ) : (
                  availableEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {getEmployeeLabel(employee)}
                    </option>
                  ))
                )}
              </NativeSelect>
            </div>

            {selectedEmployee ? (
              <div className="cd-field cd-field-info">
                Выбранный специалист: {getEmployeeLabel(selectedEmployee)}
                {selectedEmployee.roleId ? ` · ${getGroomerModifierLabel(selectedEmployee.roleId)}` : ''}
              </div>
            ) : null}

            <div className="cd-field">
              <div className="cd-field-label">Время</div>
              <NativeSelect
                value={selectedTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                disabled={availabilityLoading || slotsForSelectedEmployee.length === 0}
              >
                {availabilityLoading ? (
                  <option value="">Загрузка...</option>
                ) : slotsForSelectedEmployee.length === 0 ? (
                  <option value="">Нет слотов</option>
                ) : (
                  slotsForSelectedEmployee.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))
                )}
              </NativeSelect>
            </div>

            <div className="cd-field">
              <div className="cd-field-label">Комментарий к записи</div>
              <Textarea
                value={clientComment}
                onChange={(e) => setClientComment(e.target.value)}
                placeholder="Например, чувствительная кожа, аккуратно с ушами"
              />
            </div>

            {selectedServiceIds.length > 0 ? (
              <div className="cd-total">
                <div>Итоговая стоимость</div>
                <div className="cd-total-value">{finalServicesTotal.toFixed(2)} ₽</div>
                <div className="cd-hint">Длительность {totalServicesDuration} мин</div>
              </div>
            ) : null}

            <div className="cd-create-order-action">
              <Button
                size="l"
                stretched
                className="cd-create-order-button"
                onClick={handleCreateOrder}
                disabled={!canCreateOrder || creatingOrder}
              >
                {creatingOrder ? 'Создание...' : 'Создать заказ'}
              </Button>
            </div>
          </Group>
          ) : null}

          {activeTab === 'history' ? (
          <Group className="cd-group" header={<Header mode="secondary">Мои заказы ✨</Header>}>
            {groupedOrders.length > 0 ? (
              groupedOrders.map((order) => {
                const statusLabel = order.status || 'Ожидает';
                const status = getStatusMeta(statusLabel);
                const orderDate = order.startTime ? new Date(order.startTime).toLocaleDateString() : 'Дата не указана';
                const orderCreatedAt = order.date ? new Date(order.date).toLocaleString() : 'Дата не указана';
                const timeRange = order.startTime && order.endTime
                  ? `${new Date(order.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${new Date(order.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : '';
                const petInfo = order.petName
                  ? `Питомец: ${order.petName}${order.petBreed ? ` (${order.petBreed})` : ''}${order.petSize ? ` · ${SIZE_LABELS[order.petSize] || order.petSize}` : ''}`
                  : '';
                const serviceNames = order.services.length > 0
                  ? order.services.map((service) => service.name || 'Услуга').join(', ')
                  : 'Услуги';
                const totalPrice = Number(order.totalPrice);
                const totalLabel = Number.isFinite(totalPrice) && totalPrice > 0 ? ` · ${totalPrice.toFixed(2)} ₽` : '';
                const durationLabel = order.duration ? ` · ${order.duration} мин` : '';

                return (
                  <CardGrid key={order.id} size="l">
                  <Card mode="shadow" className="cd-card cd-order-card">
                    <SimpleCell
                      before={null}
                      after={<Badge mode={status.mode}>{status.label}</Badge>}
                      description={`Сотрудник: ${order.employeeName || 'Не назначен'} · ${orderDate}${timeRange ? ` · ${timeRange}` : ''}${totalLabel}${durationLabel}`}
                      className="cd-simplecell"
                    >
                        {serviceNames}
                      </SimpleCell>
                      {petInfo ? <SimpleCell>{petInfo}</SimpleCell> : null}
                      <SimpleCell>📌 Статус: {statusLabel}</SimpleCell>
                      <SimpleCell>🕒 Дата оформления: {orderCreatedAt}</SimpleCell>
                      <SimpleCell>🗓️ Запись: {orderDate}{timeRange ? ` · ${timeRange}` : ''}</SimpleCell>
                      <SimpleCell>🧴 Грумер: {order.employeeName || 'Не назначен'}</SimpleCell>
                      <SimpleCell>💳 Стоимость: {Number.isFinite(totalPrice) ? `${totalPrice.toFixed(2)} ₽` : 'Не указана'}</SimpleCell>
                      <SimpleCell>⏱️ Длительность: {order.duration ? `${order.duration} мин` : 'Не указана'}</SimpleCell>
                      <SimpleCell>🕒 Последний визит: {order.details?.lastVisit || 'Не указан'}</SimpleCell>
                      {order.details?.clientComment ? <SimpleCell>💬 Комментарий клиента: {order.details.clientComment}</SimpleCell> : null}
                      {order.details?.masterComment ? <SimpleCell>📝 Комментарий мастера: {order.details.masterComment}</SimpleCell> : null}
                      {!isCompletedStatus(statusLabel) && !isCancelledStatus(statusLabel) ? (
                        <div className="cd-card-actions">
                          <Button
                            size="m"
                            mode="destructive"
                            className="cd-cancel-order-button"
                            onClick={() => handleDeleteOrder(order.id)}
                          >
                            Отменить заказ
                          </Button>
                        </div>
                      ) : null}
                    </Card>
                  </CardGrid>
                );
              })
            ) : (
              <div className="cd-empty">У вас пока нет заказов</div>
            )}
          </Group>
          ) : null}
        </div>
      )}
    </Panel>
  );
};

ClientDashboard.propTypes = {
  id: PropTypes.string.isRequired,
};
