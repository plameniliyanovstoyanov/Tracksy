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

// Официални сектори за средна скорост
export const sectors: Sector[] = [
  // Северна скоростна тангента - посока 1
  {
    id: '1',
    name: 'Северна скоростна тангента: м/у 18 и п.в.Илиянци - Чепинци',
    route: 'Северна тангента',
    speedLimit: 90,
    distance: 10.3,
    description: 'Сектор за средна скорост на Северната скоростна тангента от м/у 18 и п.в.Илиянци до Чепинци.',
    startPoint: {
      lat: 42.765384,
      lng: 23.296874,
      name: 'м/у 18 и п.в.Илиянци',
      km: 50.427
    },
    endPoint: {
      lat: 42.719663,
      lng: 23.400159,
      name: 'Чепинци',
      km: 60.705
    },
    active: true,
  },
  // Северна скоростна тангента - посока 2
  {
    id: '2',
    name: 'Северна скоростна тангента: Чепинци - м/у 18 и п.в.Илиянци',
    route: 'Северна тангента',
    speedLimit: 90,
    distance: 10.3,
    description: 'Сектор за средна скорост на Северната скоростна тангента от Чепинци до м/у 18 и п.в.Илиянци.',
    startPoint: {
      lat: 42.719724,
      lng: 23.400676,
      name: 'Чепинци',
      km: 60.705
    },
    endPoint: {
      lat: 42.765465,
      lng: 23.297067,
      name: 'м/у 18 и п.в.Илиянци',
      km: 50.427
    },
    active: true,
  },
  // АМ Тракия: Вакарел - Ихтиман
  {
    id: '3',
    name: 'АМ "Тракия": Вакарел - Ихтиман',
    route: 'АМ "Тракия"',
    speedLimit: 140,
    distance: 19.2,
    description: 'Сектор за средна скорост на АМ "Тракия" от Вакарел до Ихтиман.',
    startPoint: {
      lat: 42.550441,
      lng: 23.702729,
      name: 'Вакарел',
      km: 24.288
    },
    endPoint: {
      lat: 42.427037,
      lng: 23.854172,
      name: 'Ихтиман',
      km: 43.448
    },
    active: true,
  },
  // АМ Тракия: Ихтиман - Вакарел
  {
    id: '4',
    name: 'АМ "Тракия": Ихтиман - Вакарел',
    route: 'АМ "Тракия"',
    speedLimit: 140,
    distance: 19.2,
    description: 'Сектор за средна скорост на АМ "Тракия" от Ихтиман до Вакарел.',
    startPoint: {
      lat: 42.427027,
      lng: 23.854334,
      name: 'Ихтиман',
      km: 43.448
    },
    endPoint: {
      lat: 42.550501,
      lng: 23.702878,
      name: 'Вакарел',
      km: 24.288
    },
    active: true,
  },
  // АМ Тракия: Цалапица - Радиново
  {
    id: '5',
    name: 'АМ "Тракия": Цалапица - Радиново',
    route: 'АМ "Тракия"',
    speedLimit: 140,
    distance: 10.9,
    description: 'Сектор за средна скорост на АМ "Тракия" от Цалапица до Радиново.',
    startPoint: {
      lat: 42.204971,
      lng: 24.508422,
      name: 'Цалапица',
      km: 107.663
    },
    endPoint: {
      lat: 42.198320,
      lng: 24.640244,
      name: 'Радиново',
      km: 118.599
    },
    active: true,
  },
  // АМ Тракия: Радиново - Цалапица
  {
    id: '6',
    name: 'АМ "Тракия": Радиново - Цалапица',
    route: 'АМ "Тракия"',
    speedLimit: 140,
    distance: 10.9,
    description: 'Сектор за средна скорост на АМ "Тракия" от Радиново до Цалапица.',
    startPoint: {
      lat: 42.198474,
      lng: 24.640454,
      name: 'Радиново',
      km: 118.599
    },
    endPoint: {
      lat: 42.205112,
      lng: 24.508653,
      name: 'Цалапица',
      km: 107.663
    },
    active: true,
  },
  // АМ Хемус: Белокопитово - Каспичан
  {
    id: '7',
    name: 'АМ "Хемус": Белокопитово - Каспичан',
    route: 'АМ "Хемус"',
    speedLimit: 140,
    distance: 21.3,
    description: 'Сектор за средна скорост на АМ "Хемус" от Белокопитово до Каспичан.',
    startPoint: {
      lat: 43.337025,
      lng: 26.900127,
      name: 'Белокопитово',
      km: 340.293
    },
    endPoint: {
      lat: 43.323207,
      lng: 27.149375,
      name: 'Каспичан',
      km: 361.581
    },
    active: true,
  },
  // АМ Хемус: Каспичан - Белокопитово
  {
    id: '8',
    name: 'АМ "Хемус": Каспичан - Белокопитово',
    route: 'АМ "Хемус"',
    speedLimit: 140,
    distance: 21.3,
    description: 'Сектор за средна скорост на АМ "Хемус" от Каспичан до Белокопитово.',
    startPoint: {
      lat: 43.323326,
      lng: 27.149494,
      name: 'Каспичан',
      km: 361.581
    },
    endPoint: {
      lat: 43.337108,
      lng: 26.900261,
      name: 'Белокопитово',
      km: 340.293
    },
    active: true,
  },
  // АМ Хемус: Девня - Игнатиево
  {
    id: '9',
    name: 'АМ "Хемус": Девня - Игнатиево',
    route: 'АМ "Хемус"',
    speedLimit: 140,
    distance: 17.8,
    description: 'Сектор за средна скорост на АМ "Хемус" от Девня до Игнатиево.',
    startPoint: {
      lat: 43.227263,
      lng: 27.583519,
      name: 'Девня',
      km: 399.703
    },
    endPoint: {
      lat: 43.240704,
      lng: 27.781218,
      name: 'Игнатиево',
      km: 418.126
    },
    active: true,
  },
  // АМ Хемус: Игнатиево - Девня
  {
    id: '10',
    name: 'АМ "Хемус": Игнатиево - Девня',
    route: 'АМ "Хемус"',
    speedLimit: 140,
    distance: 17.8,
    description: 'Сектор за средна скорост на АМ "Хемус" от Игнатиево до Девня.',
    startPoint: {
      lat: 43.240819,
      lng: 27.781286,
      name: 'Игнатиево',
      km: 418.126
    },
    endPoint: {
      lat: 43.227388,
      lng: 27.583576,
      name: 'Девня',
      km: 399.703
    },
    active: true,
  },
  // АМ Струма: Сандански - Дамяница
  {
    id: '11',
    name: 'АМ "Струма": Сандански - Дамяница',
    route: 'АМ "Струма"',
    speedLimit: 140,
    distance: 7.3,
    description: 'Сектор за средна скорост на АМ "Струма" от Сандански до Дамяница.',
    startPoint: {
      lat: 41.573158,
      lng: 23.239660,
      name: 'Сандански',
      km: 143.945
    },
    endPoint: {
      lat: 41.514578,
      lng: 23.271410,
      name: 'Дамяница',
      km: 151.251
    },
    active: true,
  },
  // АМ Струма: Дамяница - Сандански
  {
    id: '12',
    name: 'АМ "Струма": Дамяница - Сандански',
    route: 'АМ "Струма"',
    speedLimit: 140,
    distance: 7.3,
    description: 'Сектор за средна скорост на АМ "Струма" от Дамяница до Сандански.',
    startPoint: {
      lat: 41.514526,
      lng: 23.271567,
      name: 'Дамяница',
      km: 151.251
    },
    endPoint: {
      lat: 41.573126,
      lng: 23.239829,
      name: 'Сандански',
      km: 143.945
    },
    active: true,
  },
  // АМ Струма: Българчево - Покровник
  {
    id: '13',
    name: 'АМ "Струма": Българчево - Покровник',
    route: 'АМ "Струма"',
    speedLimit: 140,
    distance: 2.3,
    description: 'Сектор за средна скорост на АМ "Струма" от Българчево до Покровник.',
    startPoint: {
      lat: 42.011553,
      lng: 23.044707,
      name: 'Българчево',
      km: 90.219
    },
    endPoint: {
      lat: 41.991924,
      lng: 23.053900,
      name: 'Покровник',
      km: 92.548
    },
    active: true,
  },
  // АМ Струма: Покровник - Българчево
  {
    id: '14',
    name: 'АМ "Струма": Покровник - Българчево',
    route: 'АМ "Струма"',
    speedLimit: 140,
    distance: 2.3,
    description: 'Сектор за средна скорост на АМ "Струма" от Покровник до Българчево.',
    startPoint: {
      lat: 41.991906,
      lng: 23.054074,
      name: 'Покровник',
      km: 92.548
    },
    endPoint: {
      lat: 42.011574,
      lng: 23.044874,
      name: 'Българчево',
      km: 90.219
    },
    active: true,
  },
  // Път I-1: Слатино - Кочериново
  {
    id: '15',
    name: 'Път I-1: Слатино - Кочериново',
    route: 'Път I-1',
    speedLimit: 90,
    distance: 10.6,
    description: 'Сектор за средна скорост на път I-1 от Слатино до Кочериново.',
    startPoint: {
      lat: 42.157838,
      lng: 23.041095,
      name: 'Слатино',
      km: 343.292
    },
    endPoint: {
      lat: 42.064193,
      lng: 23.038512,
      name: 'Кочериново',
      km: 353.878
    },
    active: true,
  },
  // Път I-1: Кочериново - Слатино
  {
    id: '16',
    name: 'Път I-1: Кочериново - Слатино',
    route: 'Път I-1',
    speedLimit: 90,
    distance: 10.6,
    description: 'Сектор за средна скорост на път I-1 от Кочериново до Слатино.',
    startPoint: {
      lat: 42.064193,
      lng: 23.038512,
      name: 'Кочериново',
      km: 353.878
    },
    endPoint: {
      lat: 42.157838,
      lng: 23.041095,
      name: 'Слатино',
      km: 343.292
    },
    active: true,
  },
  {
    id: '17',
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
    id: '18',
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
    id: '19',
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
    id: '20',
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