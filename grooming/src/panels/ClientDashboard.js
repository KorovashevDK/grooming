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
  Checkbox,
  Input,
  Textarea,
  Tabs,
  TabsItem,
} from '@vkontakte/vkui';
import { useAuth } from '../contexts/AuthContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

const getRecencyModifierLabel = (recency) => (
  GROOMING_RECENCY_OPTIONS.find((option) => option.value === recency)?.modifier || 'без надбавки'
);

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

export const ClientDashboard = ({ id }) => {
  const { logout } = useAuth();
  const routeNavigator = useRouteNavigator();
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [pets, setPets] = useState([]);
  const [services, setServices] = useState([]);
  const [employees, setEmployees] = useState([]);
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
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState('');

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
      const numeric = Number(service?.durationMinutes);
      return sum + (Number.isFinite(numeric) && numeric > 0 ? numeric : 60);
    }, 0);
  }, [services, selectedServiceIds]);

  const finalServicesTotal = baseServicesTotal * sizeCoefficient * recencyCoefficient * groomerLevelCoefficient;

  const canCreateOrder = useMemo(
    () => Boolean(selectedPetId && selectedServiceIds.length > 0 && selectedEmployeeId && selectedDate && selectedTime),
    [selectedPetId, selectedServiceIds, selectedEmployeeId, selectedDate, selectedTime],
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
      setSelectedEmployeeId('');
      setSelectedTime('');
      return;
    }

    setAvailabilityLoading(true);
    setAvailabilityMessage('');

    try {
      const availability = await clientApi.getAvailability({
        date: dateValue,
        serviceIds: serviceIdsValue,
      });

      setAvailableEmployees(availability.employees || []);

      if ((availability.employees || []).length === 0) {
        setAvailabilityMessage('Нет доступных грумеров на выбранную дату');
      }

      const firstEmployee = (availability.employees || [])[0];
      if (firstEmployee) {
        setSelectedEmployeeId(firstEmployee.id);
        setSelectedTime(firstEmployee.slots?.[0] || '');
      } else {
        setSelectedEmployeeId('');
        setSelectedTime('');
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      setAvailabilityMessage('Не удалось загрузить доступные слоты');
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAvailability(selectedDate, selectedServiceIds);
  }, [selectedDate, selectedServiceIds, refreshAvailability]);

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
    if (!selectedPetId || orders.length === 0) {
      return;
    }

    const petOrders = orders
      .filter((order) => order['Код_груминг_клиента'] === selectedPetId && order.serviceStart)
      .sort((a, b) => new Date(b.serviceStart).getTime() - new Date(a.serviceStart).getTime());

    if (petOrders.length === 0) {
      setGroomingRecency('never');
      return;
    }

    const lastVisit = new Date(petOrders[0].serviceStart);
    const daysDiff = Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 30) {
      setGroomingRecency('recent');
    } else if (daysDiff <= 90) {
      setGroomingRecency('1_3_months');
    } else {
      setGroomingRecency('3_plus_months');
    }
  }, [selectedPetId, orders]);

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
      setClientComment('');
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
          duration: order.serviceDuration,
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
      setSelectedTime(slotsForSelectedEmployee[0] || '');
    }
    if (slotsForSelectedEmployee.length === 0) {
      setSelectedTime('');
    }
  }, [selectedTime, slotsForSelectedEmployee]);

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
              Выбор роли
            </Button>
            <Button
              mode="tertiary"
              size="s"
              className="cd-header-exit-button"
              onClick={logout}
            >
              Выйти
            </Button>
          </div>
        )}
      >
        Пёс Пижон · Личный кабинет
      </PanelHeader>

      {loading ? (
        <div className="cd-loading">
          <div className="cd-spinner" />
        </div>
      ) : (
        <div className="cd-page">
          <div className="cd-toolbar">
            <Button mode="secondary" size="m" onClick={() => routeNavigator.push('/role-menu')}>
              Выбор роли
            </Button>
            <Button mode="tertiary" size="m" onClick={logout}>
              Выйти
            </Button>
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
              <CardGrid size="l">
                <Card mode="shadow" className="cd-card">
                  <SimpleCell
                    before={<Avatar size={48} initials={profile['ФИО']?.charAt(0) || 'К'} />}
                    description={profile['Номер_телефона'] || 'Телефон не указан'}
                    className="cd-simplecell"
                  >
                    {profile['ФИО'] || 'Клиент'}
                  </SimpleCell>
                </Card>
              </CardGrid>
            </Group>
          )}

          <Group className="cd-group" header={<Header mode="secondary">Управление 🧭</Header>}>
            <Tabs className="cd-tabs">
              <TabsItem selected={activeTab === 'orders'} onClick={() => setActiveTab('orders')}>
                Запись
              </TabsItem>
              <TabsItem selected={activeTab === 'pets'} onClick={() => setActiveTab('pets')}>
                Питомцы
              </TabsItem>
              <TabsItem selected={activeTab === 'history'} onClick={() => setActiveTab('history')}>
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
                  <Button size="s" mode="secondary" onClick={() => setShowAddPet((prev) => !prev)}>
                    {showAddPet ? 'Скрыть форму' : 'Добавить'}
                  </Button>
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
                        className="cd-simplecell"
                        after={
                          <Button
                            size="s"
                            mode="secondary"
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
                <Button size="l" stretched onClick={handleCreatePet} disabled={!newPetName || creatingPet}>
                  {creatingPet ? 'Добавление...' : 'Добавить питомца'}
                </Button>
              </FormItem>
            </div>
            ) : null}
          </Group>
          ) : null}

          {activeTab === 'orders' ? (
          <Group className="cd-group" header={<Header mode="secondary">Создать заказ ✂️</Header>}>
            <FormItem top="Питомец">
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
            </FormItem>

            {selectedPet ? (
              <FormItem>
                <SimpleCell>
                  Размер питомца: {SIZE_LABELS[selectedPet.size || 'small']} · {getSizeModifierLabel(selectedPet.size || 'small')}
                </SimpleCell>
              </FormItem>
            ) : null}

            <FormItem top="Когда были на груминге в последний раз">
              <NativeSelect value={groomingRecency} onChange={(e) => setGroomingRecency(e.target.value)}>
                {GROOMING_RECENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormItem>

            <FormItem>
              <SimpleCell>
                Последний груминг: {getRecencyModifierLabel(groomingRecency)}
              </SimpleCell>
            </FormItem>

            <FormItem top="Услуги">
              {filteredServices.length === 0 ? (
                <div className="cd-empty">Нет услуг</div>
              ) : (
                <div className="cd-service-list">
                  {filteredServices.map((service) => {
                    const isChecked = selectedServiceIds.includes(service.id);
                    const numericPrice = Number(service.price);
                    const priceLabel = Number.isFinite(numericPrice) ? `${numericPrice} ₽` : 'Цена не указана';
                    const durationLabel = Number.isFinite(Number(service.durationMinutes))
                      ? `${service.durationMinutes} мин`
                      : '60 мин';

                    return (
                      <div key={service.id} className="cd-service-row">
                        <Checkbox
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedServiceIds((prev) =>
                              e.target.checked ? [...prev, service.id] : prev.filter((id) => id !== service.id),
                            )
                          }
                        >
                          {service.name} · Базовая цена {priceLabel} · {durationLabel}
                        </Checkbox>
                        {service.description ? (
                          <div className="cd-service-desc">
                            {service.description}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </FormItem>

            <FormItem>
              <div className="cd-hint cd-note-box">
                У услуги указана базовая цена. Финальная стоимость рассчитывается с учётом размера питомца, давности последнего визита и уровня выбранного грумера.
              </div>
            </FormItem>

            <FormItem top="Дата заказа">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="cd-date-input"
              />
            </FormItem>

            {availabilityMessage ? <SimpleCell>{availabilityMessage}</SimpleCell> : null}

            <FormItem top="Грумер">
              <NativeSelect
                value={selectedEmployeeId}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedEmployeeId(value);
                  const employee = availableEmployees.find((item) => item.id === value);
                  setSelectedTime(employee?.slots?.[0] || '');
                }}
                disabled={availabilityLoading || availableEmployees.length === 0}
              >
                {availabilityLoading ? (
                  <option value="">Загрузка...</option>
                ) : availableEmployees.length === 0 ? (
                  <option value="">Нет доступных</option>
                ) : (
                  availableEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.displayName || `${employee.fullName}${employee.roleName ? ` · ${employee.roleName}` : ''}`}
                    </option>
                  ))
                )}
              </NativeSelect>
            </FormItem>

            {selectedEmployee ? (
              <FormItem>
                <SimpleCell>
                  Выбранный специалист: {selectedEmployee.displayName || selectedEmployee.fullName}
                  {selectedEmployee.roleId ? ` · ${getGroomerModifierLabel(selectedEmployee.roleId)}` : ''}
                </SimpleCell>
              </FormItem>
            ) : null}

            <FormItem top="Время">
              <NativeSelect
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
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
            </FormItem>

            <FormItem top="Комментарий к записи">
              <Textarea
                value={clientComment}
                onChange={(e) => setClientComment(e.target.value)}
                placeholder="Например, чувствительная кожа, аккуратно с ушами"
              />
            </FormItem>

            {selectedServiceIds.length > 0 ? (
              <FormItem>
                <div className="cd-total">
                  <div>Итоговая стоимость</div>
                  <div className="cd-total-value">{finalServicesTotal.toFixed(2)} ₽</div>
                  <div className="cd-hint">Длительность {totalServicesDuration} мин</div>
                </div>
              </FormItem>
            ) : null}

            <FormItem>
              <Button size="l" stretched onClick={handleCreateOrder} disabled={!canCreateOrder || creatingOrder}>
                {creatingOrder ? 'Создание...' : 'Создать заказ'}
              </Button>
            </FormItem>
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
                          <Button size="m" mode="destructive" onClick={() => handleDeleteOrder(order.id)}>
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
