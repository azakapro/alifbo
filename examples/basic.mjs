import { foldSearchKey, fromCyrillic, toCyrillic, toNewLatin, toOldLatin } from 'alifbo';

console.log(toNewLatin("O'zbekiston shaharlari").text);
console.log(toOldLatin('Özbekiston şaharlari').text);

const cyrillic = fromCyrillic('Елена');
console.log(cyrillic.text);
console.error(cyrillic.warnings);

console.log(toCyrillic('Şavkat').text);
console.log(foldSearchKey('Шавкат') === foldSearchKey('Shavkat'));
