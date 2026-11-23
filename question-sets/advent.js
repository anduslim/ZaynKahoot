// Built-in "Advent & Christmas Trivia 2026" question set (mission trip, children in groups).
// Pick it in Admin → Questions → Question sets, or edit it there.
//
// Question types used here:
//   choice  Multiple choice with up to 6 answers. `correct` lists the right answers (0-based).
//           `pick` is how many answers a group chooses; it is right when every pick is correct.
//           So "name any two" with four right answers is correct: [..4], pick: 2.
//   text    Groups type their answer. `answers` are the accepted answers, one item per entry,
//           with "/" between words that mean the same thing. `needed` is how many different
//           items the answer must name. A local AI model judges the answers (see README) and
//           the host can tap any answer to mark it right or wrong.
module.exports = {
  id: 'advent',
  name: 'Advent & Christmas 2026',
  title: 'Advent Trivia',
  points: 1,
  finale: 'none',
  questions: [
    {
      id: 'adv-sundays', type: 'choice', timeLimit: 30,
      text: 'How many Sundays of Advent are there before Christmas?',
      fact: 'There are 4 Sundays of Advent, and we light one more candle each week!',
      options: [{ label: '2', emoji: '2️⃣' }, { label: '3', emoji: '3️⃣' }, { label: '4', emoji: '4️⃣' }, { label: '5', emoji: '5️⃣' }, { label: '6', emoji: '6️⃣' }, { label: '12', emoji: '🔢' }],
      correct: [2],
    },
    {
      id: 'adv-rose', type: 'choice', timeLimit: 30,
      text: 'For each Sunday of Advent, a candle is lit. What is the colour of the candle for the Third Sunday of Advent?',
      fact: 'The rose (pink) candle is lit on the Third Sunday, the Sunday of joy!',
      options: [{ label: 'Purple', emoji: '🟣' }, { label: 'Rose / Pink', emoji: '🌸' }, { label: 'Red', emoji: '🔴' }, { label: 'White', emoji: '⚪' }, { label: 'Green', emoji: '🟢' }, { label: 'Gold', emoji: '🟡' }],
      correct: [1],
    },
    {
      id: 'adv-gaudete', type: 'text', timeLimit: 60,
      text: 'What is another name for the Third Sunday of Advent?',
      fact: 'Gaudete means "Rejoice!" in Latin.',
      answers: ['Gaudete / Gaudete Sunday'],
      needed: 1,
      notes: 'Accept close spellings of Gaudete (e.g. Gaudeti, Gowdetay). "Rose Sunday" or "Joy Sunday" alone is not the name asked for.',
    },
    {
      id: 'adv-candles', type: 'choice', timeLimit: 45, pick: 2,
      text: 'Each Advent candle stands for something. Pick any two!',
      hint: 'Choose 2 answers',
      fact: 'Week 1 Hope, Week 2 Peace, Week 3 Joy, Week 4 Love.',
      options: [{ label: 'Hope', emoji: '🙏' }, { label: 'Peace', emoji: '🕊️' }, { label: 'Joy', emoji: '😊' }, { label: 'Love', emoji: '❤️' }, { label: 'Presents', emoji: '🎁' }, { label: 'Snow', emoji: '❄️' }],
      correct: [0, 1, 2, 3],
    },
    {
      id: 'adv-purple', type: 'choice', timeLimit: 30,
      text: 'What is the Liturgical Colour for Advent?',
      fact: 'Purple is the colour of Advent, a season of getting ready.',
      options: [{ label: 'Purple', emoji: '🟣' }, { label: 'Green', emoji: '🟢' }, { label: 'Red', emoji: '🔴' }, { label: 'White', emoji: '⚪' }, { label: 'Black', emoji: '⚫' }, { label: 'Gold', emoji: '🟡' }],
      correct: [0],
    },
    {
      id: 'adv-why-purple', type: 'text', timeLimit: 60,
      text: 'Why is the Liturgical Colour purple?',
      fact: 'Purple reminds us to prepare our hearts to welcome Jesus.',
      answers: ['Penitence / penance / being sorry for our sins / repentance', 'To prepare ourselves spiritually to welcome Jesus in our hearts (through reconciliation, forgiveness and good deeds)'],
      needed: 1,
      notes: 'Either idea is enough: being sorry / penance, or getting our hearts ready for Jesus (confession, forgiving others, doing good). "Because it is a royal colour for Jesus the King" is also acceptable. Wrong: "because it is pretty", "because the priest likes it".',
    },
    {
      id: 'adv-why-christmas', type: 'choice', timeLimit: 45, pick: 2,
      text: 'Why do we celebrate Christmas every year? Pick the two reasons!',
      hint: 'Choose 2 answers',
      fact: 'We remember Jesus’ first coming (the Incarnation) and wait for His second coming (the Parousia).',
      options: [
        { label: 'To remember Jesus’ first coming (Incarnation)', emoji: '👶' },
        { label: 'To await Jesus’ second coming (Parousia)', emoji: '✨' },
        { label: 'To get presents', emoji: '🎁' },
        { label: 'Because of Santa', emoji: '🎅' },
        { label: 'For the school holidays', emoji: '🏖️' },
        { label: 'To eat yummy food', emoji: '🍗' },
      ],
      correct: [0, 1],
    },
    {
      id: 'adv-john', type: 'text', timeLimit: 60,
      text: 'When Mary visited her cousin Elizabeth, the unborn baby in Elizabeth’s womb leapt with joy. What is the name of the baby?',
      fact: 'John the Baptist leapt for joy when Mary, carrying Jesus, arrived!',
      answers: ['John the Baptist / John / St John the Baptist'],
      needed: 1,
      notes: '"John" alone is correct. "John the Apostle" or "Jesus" is wrong.',
    },
    {
      id: 'adv-bethlehem', type: 'choice', timeLimit: 30,
      text: 'In which city was Jesus born?',
      fact: 'Jesus was born in Bethlehem, the city of King David.',
      options: [{ label: 'Nazareth', emoji: '🏘️' }, { label: 'Jerusalem', emoji: '🏛️' }, { label: 'Bethlehem', emoji: '⭐' }, { label: 'Rome', emoji: '🏟️' }],
      correct: [2],
    },
    {
      id: 'adv-manger', type: 'text', timeLimit: 60,
      text: 'Jesus was laid in a manger. What is a manger?',
      fact: 'A manger is a feeding box for animals. Jesus, the Bread of Life, was laid in one!',
      answers: ['A trough or open box in a stable or barn used to hold food (such as hay) for animals like horses and cattle'],
      needed: 1,
      notes: 'Correct if it says it is where animals eat or where their food/hay is kept (feeding box, food tray, trough for animals). "A stable", "a barn" or "a bed" alone is wrong.',
    },
    {
      id: 'adv-magi', type: 'text', timeLimit: 60,
      text: 'Who were the special people from the East who visited Jesus after His birth?',
      fact: 'The Wise Men followed the star to find Jesus.',
      answers: ['Wise Men / Three Kings / Kings / Magi / Three Wise Men / Biblical Magi'],
      needed: 1,
      notes: 'Shepherds or angels are wrong. Naming Caspar, Melchior and Balthasar is correct.',
    },
    {
      id: 'adv-gifts', type: 'text', timeLimit: 60,
      text: 'What gifts did the Magi bring for Baby Jesus? Name one of them.',
      fact: 'Gold for a King, frankincense for God, and myrrh for His death and burial.',
      answers: ['Gold', 'Frankincense', 'Myrrh'],
      needed: 1,
      notes: 'Accept close spellings (e.g. frankinsense, mur, mir). If several are named and at least one is right, it is correct.',
    },
  ],
};
