# The Elements of Style

Typography is the craft of giving language a durable form. A page sets its **strong** and *emphasised* words, its `inline code` and its [links](https://typora.io) with care, and ==highlights== only what matters.

> Good design is as little design as possible. It goes back to the purity of the text.

## A short checklist

- Choose a typeface that suits the text
- Set a comfortable measure
  - Forty-five to seventy-five characters

1. Read it aloud
2. Print a proof

- [x] Fix the headings
- [ ] Hang the punctuation

### Sizes and leading

| Use     | Size  | Leading |
| ------- | ----- | ------- |
| Body    | 16 px | 1.6     |
| Caption | 13 px | 1.4     |

```js
function measure(text, width) {
  const words = text.split(" ");
  return words.length / width; // 66 is ideal
}
```

---

#### Further reading

Details hide in the margins.
