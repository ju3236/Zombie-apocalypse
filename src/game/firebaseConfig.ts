import type { FirebaseOptions } from 'firebase/app';

/** 이 게임이 쓰는 Firebase 프로젝트 (웹 앱 설정값은 공개되어도 괜찮다. 보안은 데이터베이스 규칙이 지킨다) */
export const MAIN_FIREBASE: FirebaseOptions = {
  apiKey: 'AIzaSyCupRJDps9393NesE2wJSM4K-ISgZMniaY',
  authDomain: 'zombie-apocalypse-e29e3.firebaseapp.com',
  databaseURL: 'https://zombie-apocalypse-e29e3-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'zombie-apocalypse-e29e3',
  storageBucket: 'zombie-apocalypse-e29e3.firebasestorage.app',
  messagingSenderId: '364599037253',
  appId: '1:364599037253:web:067f18181a8d659256022c',
};
