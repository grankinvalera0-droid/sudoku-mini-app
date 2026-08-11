import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes

# ========== НАСТРОЙКИ ==========
BOT_TOKEN = "8908486550:AAGT_kmknREziR-FWD1a-NbTqwWU77-B1rE"
WEBAPP_URL = "https://grankinvalera0-droid.github.io/sudoku-mini-app/"  # ← должно быть так

# ========== ОБРАБОТЧИКИ ==========
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отправка кнопки для открытия Mini App"""
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            "🎮 Играть в Судоку",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )]
    ])
    
    await update.message.reply_text(
        "🧩 *Добро пожаловать в Судоку!*\n\n"
        "Нажми на кнопку ниже, чтобы открыть игру.\n"
        "Доступные уровни сложности:\n"
        "🟢 Легко\n"
        "🟡 Средне\n"
        "🔴 Сложно\n"
        "💀 Эксперт",
        reply_markup=keyboard,
        parse_mode="Markdown"
    )

# ========== ЗАПУСК ==========
def main():
    logging.basicConfig(level=logging.INFO)
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    
    print("🤖 Бот запущен...")
    app.run_polling()

if __name__ == "__main__":
    main()
