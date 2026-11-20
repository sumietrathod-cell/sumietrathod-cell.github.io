# Gujarati speech to English dictation

Speak each example naturally. Accept equivalent English wording when every detail survives. Record the actual text before grading. Only the public reference sample has a prior measured result. The business examples below are synthetic and untested.

| Spoken Gujarati | Expected meaning in English | Check |
|---|---|---|
| કાલે પંદર બોક્સ મોકલવાના છે, પચાસ નહીં. | Send fifteen boxes tomorrow, not fifty. | Quantity, correction, tomorrow |
| કાલે સવારે દસ વાગ્યે ફોન કરજો. | Please call tomorrow at ten in the morning. | Day and AM |
| ઓર્ડર રદ કરશો નહીં. | Do not cancel the order. | Negation |
| ભાવ સાડા ત્રણસો રૂપિયા છે. | The price is 350 rupees. | Currency and amount |
| ડેમો શુક્રવારથી સોમવારે ખસેડો. | Move the demo from Friday to Monday. | Direction of change |
| જો માલ આવે તો જ બિલ બનાવજો. | Create the bill only if the goods arrive. | Condition |

## Known failing reference

Use the public [Gujarati audio sample and reference text](https://github.com/meeeetxd/pocket-tts-gujarati). In out.wav the closing clause says that unexpected moments sometimes become the most beautiful memories. In the November 20 web test Whisper Small rendered this as a beautiful memory of a very short time. Mark a result that drops the unexpectedness as a meaning error.

## Phone acceptance checks

- In an AAROHAN order or notes field, dictate at the cursor and check surrounding text is preserved.
- In live demo mode, observe whether English appears before recording stops. Measure time to first English words and time from release to final text separately. Check that finalization does not duplicate the preview.
- With the Android input method selected, repeat in WhatsApp, Gmail and a plain notes app. Confirm the result remains an editable draft and no message is sent.
