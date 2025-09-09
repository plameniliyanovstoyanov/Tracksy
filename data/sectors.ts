export interface Sector {
  id: string;
  name: string;
  route: string;
  speedLimit: number;
  distance: number;
  description: string;
  startPoint: {
    lat: number;
    lng: number;
    name: string;
    km?: number;
  };
  endPoint: {
    lat: number;
    lng: number;
    name: string;
    km?: number;
  };
  active: boolean;
}

// Реални координати за секторите с камери
export const sectors: Sector[] = [
  {
    id: '1',
    name: 'Магистрала Тракия: Вакарел - Ихтиман',
    route: 'А1 Тракия',
    speedLimit: 140,
    distance: 15,
    description: 'Сектор за средна скорост на магистрала Тракия между Вакарел и Ихтиман. Активен в двете посоки.',
    startPoint: {
      lat: 42.550432,
      lng: 23.702740,
      name: 'Вакарел',
    },
    endPoint: {
      lat: 42.427046,
      lng: 23.854249,
      name: 'Ихтиман',
    },
    active: true,
  },
  {
    id: '2',
    name: 'Северна скоростна тангента',
    route: 'Северна тангента',
    speedLimit: 90,
    distance: 12,
    description: 'Сектор за средна скорост на Северната скоростна тангента в София. Активен в двете посоки.',
    startPoint: {
      lat: 42.765426,
      lng: 23.296965,
      name: 'Начало',
    },
    endPoint: {
      lat: 42.719685,
      lng: 23.400511,
      name: 'Край',
    },
    active: true,
  },
  {
    id: '3',
    name: 'Тестови сектор 1',
    route: 'Тест',
    speedLimit: 90,
    distance: 2,
    description: 'Тестови сектор за проверка на функционалността на приложението.',
    startPoint: {
      lat: 42.756026,
      lng: 23.264041,
      name: 'Начало',
    },
    endPoint: {
      lat: 42.738384,
      lng: 23.250372,
      name: 'Край',
    },
    active: true,
  },
  {
    id: '4',
    name: 'Тестови сектор 2',
    route: 'Тест',
    speedLimit: 90,
    distance: 2,
    description: 'Втори тестови сектор за проверка на функционалността на приложението.',
    startPoint: {
      lat: 42.738850,
      lng: 23.250915,
      name: 'Начало',
    },
    endPoint: {
      lat: 42.755961,
      lng: 23.264194,
      name: 'Край',
    },
    active: true,
  },
  {
    id: '5',
    name: 'Тестови сектор 3',
    route: 'Тест',
    speedLimit: 50,
    distance: 2.5,
    description: 'Тестови сектор 3 - посока 1',
    startPoint: {
      lat: 42.719768,
      lng: 23.312980,
      name: 'Начало',
    },
    endPoint: {
      lat: 42.711575,
      lng: 23.332244,
      name: 'Край',
    },
    active: true,
  },
  {
    id: '6',
    name: 'Тестови сектор 4',
    route: 'Тест',
    speedLimit: 50,
    distance: 2.5,
    description: 'Тестови сектор 4 - посока 2',
    startPoint: {
      lat: 42.711667,
      lng: 23.332356,
      name: 'Начало',
    },
    endPoint: {
      lat: 42.719898,
      lng: 23.312969,
      name: 'Край',
    },
    active: true,
  },
];