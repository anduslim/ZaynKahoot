// ============================================================
//  ZAYN'S KAHOOT — QUESTION CONTENT
//  Edit this file to change questions, options and answers.
//  `correct` is the index (0-based) of the right option.
//  Images live in /public/assets/...  Missing images fall back
//  to a labelled tile, so the game never breaks.
// ============================================================

const POKEMON = [
  'Pikachu', 'Charmander', 'Charizard', 'Bulbasaur', 'Squirtle',
  'Mewtwo', 'Mew', 'Dragonite', 'Slowpoke', 'Snorlax',
  'Eevee', 'Jigglypuff', 'Psyduck', 'Gengar', 'Gyarados',
  'Meowth', 'Magikarp', 'Lapras', 'Vulpix', 'Onix',
];

module.exports = {
  title: "Zayn's Kahoot",

  // Zayn's real height in cm, used for the "stretch" effect baseline.
  // The full-body photo used for the height question:
  heightPhoto: '/assets/zayn/batman_fist.png',

  questions: [
    {
      id: 'hero',
      fact: 'Zayn loves the Hulk!',
      type: 'hero',
      text: "What is Zayn's favourite superhero?",
      options: [
        { label: 'Batman', img: '/assets/zayn/batman_fist.png', colors: ['#1b1b1f', '#f5c518'] },
        { label: 'Spider-Man', img: '/assets/zayn/spidey_mcu.png', colors: ['#d62828', '#1d4ed8'] },
        { label: 'Hulk', img: '/assets/zayn/hulk.png', colors: ['#2f9e44', '#7b2cbf'] },
        { label: 'Iron Man', img: '/assets/zayn/ironman_mystery.png', colors: ['#b91c1c', '#f59e0b'] },
      ],
      correct: 2, // Hulk
      timeLimit: 20,
      minigame: 'climb',
    },
    {
      id: 'pokemon',
      fact: "Pikachu is Zayn's favourite!",
      type: 'pokemon',
      text: "What is Zayn's favourite Pokémon?",
      options: POKEMON.map((n) => ({ label: n, img: `/assets/pokemon/${n.toLowerCase()}.png` })),
      correct: 0, // Pikachu
      timeLimit: 30,
      minigame: 'catch',
      mysteryImg: '/assets/pokemon/pikachu.png', // shown as a black silhouette until caught
    },
    {
      id: 'animal',
      fact: 'Zayn loves toucans!',
      type: 'animal',
      text: "What is Zayn's favourite animal?",
      options: [
        { label: 'Lion', emoji: '🦁', sound: 'lion', anim: 'roar', bg: '#f4a261' },
        { label: 'Elephant', emoji: '🐘', sound: 'elephant', anim: 'stomp', bg: '#8ecae6' },
        { label: 'Toucan', emoji: '🦜', sound: 'toucan', anim: 'fly', bg: '#ffb703' },
        { label: 'Monkey', emoji: '🐒', sound: 'monkey', anim: 'swing', bg: '#95d5b2' },
      ],
      correct: 2, // Toucan
      timeLimit: 20,
    },
    {
      id: 'height',
      fact: 'Zayn is 96 cm tall!',
      type: 'height',
      text: 'How tall is Zayn?',
      options: [
        { label: '85 cm', value: 85 },
        { label: '96 cm', value: 96 },
        { label: '100 cm', value: 100 },
        { label: '110 cm', value: 110 },
      ],
      correct: 1, // 96 cm
      timeLimit: 20,
    },
    {
      id: 'countries',
      fact: '11 countries already!',
      type: 'countries',
      text: 'How many countries has Zayn travelled to for holiday?',
      options: [
        { label: '6', value: 6 },
        { label: '9', value: 9 },
        { label: '11', value: 11 },
        { label: '14', value: 14 },
      ],
      correct: 2,
      timeLimit: 20,
      reveal: [
        ['🇲🇾', 'Malaysia'], ['🇹🇭', 'Thailand'], ['🇨🇳', 'China / HK'], ['🇵🇭', 'Philippines'],
        ['🇰🇷', 'South Korea'], ['🇯🇵', 'Japan'], ['🇹🇼', 'Taiwan'], ['🇻🇳', 'Vietnam'],
        ['🇦🇺', 'Australia'], ['🇷🇴', 'Romania'], ['🇧🇬', 'Bulgaria'],
      ],
    },
    {
      id: 'food',
      fact: 'Chicken and egg, every time!',
      type: 'food',
      text: "What is Zayn's staple food?",
      hint: 'Hint: his response when you ask him what he likes to eat!',
      options: [
        { label: 'Chicken and egg', emoji: '🍗🥚' },
        { label: 'Vegetables', emoji: '🥦🥕' },
        { label: 'Satay and BBQ chicken', emoji: '🍢🔥' },
        { label: 'Desserts', emoji: '🍰🍦' },
      ],
      correct: 0, // Chicken and egg
      timeLimit: 20,
    },
    {
      id: 'colour',
      fact: 'Red and green all the way!',
      type: 'colour',
      text: "What is Zayn's favourite colour?",
      options: [
        { label: 'Blue and yellow', colors: ['#2563eb', '#facc15'] },
        { label: 'Red and green', colors: ['#dc2626', '#16a34a'] },
        { label: 'Pink and purple', colors: ['#ec4899', '#8b5cf6'] },
        { label: 'Black and orange', colors: ['#111827', '#f97316'] },
      ],
      correct: 1,
      timeLimit: 20,
    },
    {
      id: 'career',
      fact: 'Zayn wants to stay at home!',
      type: 'career',
      text: 'What does Zayn want to be when he grows up?',
      options: [
        { label: 'Policeman', emoji: '👮' },
        { label: 'Soldier', emoji: '🪖' },
        { label: 'Teacher', emoji: '🧑‍🏫' },
        { label: 'Stay at home', emoji: '🛋️' },
      ],
      correct: 3,
      timeLimit: 20,
    },
  ],

  // The grand finale before final rankings
  finale: 'race',

  // Bonus points by finishing position in mini games (1st, 2nd, 3rd ...)
  minigameBonus: [600, 500, 400, 320, 260, 220, 190, 170, 150, 130],
  minigameParticipation: 100,
  raceMultiplier: 1.5,
};
