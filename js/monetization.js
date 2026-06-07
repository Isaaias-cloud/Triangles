(function () {
  "use strict";

  const DEFAULT_CONFIG = {
    banners: {
      "menu-bottom": { label: "Banner menu principal", size: "728x90" },
      "levels-inline": { label: "Banner seleccion de niveles", size: "728x90" },
      "victory-small": { label: "Banner victoria", size: "320x50" },
      "settings-bottom": { label: "Banner configuracion", size: "320x50" }
    },
    economy: {
      completionCoins: 30,
      perfectBonus: 20,
      rewardedCoins: 40,
      hintCost: 25,
      unlockCost: 90,
      themeCost: 120,
      premiumBonusHints: 8
    },
    rewards: {
      hint: { coins: 0, hints: 1 },
      unlock: { coins: 0, unlocks: 1 },
      recoverStar: { coins: 0, recoverStar: true },
      doubleReward: { coins: 0, doubleReward: true },
      specialHelp: { coins: 0, hints: 2 },
      coins: { coins: 40 }
    },
    interstitial: {
      levelsBetweenAds: 5
    }
  };

  class AdManager {
    constructor(options) {
      this.getData = options.getData;
      this.saveData = options.saveData;
      this.onReward = options.onReward;
      this.onEconomyChanged = options.onEconomyChanged;
      this.config = Object.assign({}, DEFAULT_CONFIG, options.config || {});
      this.modal = {
        root: document.getElementById("adModal"),
        kind: document.getElementById("adModalKind"),
        title: document.getElementById("adModalTitle"),
        text: document.getElementById("adModalText"),
        countdown: document.getElementById("adCountdown"),
        continueBtn: document.getElementById("adContinueBtn")
      };
    }

    isPremium() {
      return Boolean(this.getData().economy.premium);
    }

    showBannerAd(position) {
      const slot = document.querySelector('[data-ad-position="' + position + '"]');
      if (!slot) return false;
      if (this.isPremium()) {
        slot.classList.add("d-none");
        return false;
      }
      const meta = this.config.banners[position] || { label: "Banner", size: "responsive" };
      slot.classList.remove("d-none");
      slot.innerHTML = '<div class="ad-placeholder"><span>' + meta.label + '</span><strong>Anuncio de prueba</strong><small>' + meta.size + ' - reemplazable por AdSense / GAM / AdMob</small></div>';
      this.recordAd("bannersShown");
      return true;
    }

    hideBannerAd(position) {
      const slot = document.querySelector('[data-ad-position="' + position + '"]');
      if (!slot) return;
      slot.classList.add("d-none");
    }

    refreshBannerAd(position) {
      this.hideBannerAd(position);
      return this.showBannerAd(position);
    }

    canShowInterstitial() {
      const data = this.getData();
      if (this.isPremium()) return false;
      const completed = data.monetization.levelsCompletedSinceInterstitial || 0;
      return completed >= this.config.interstitial.levelsBetweenAds;
    }

    showInterstitialAd() {
      if (!this.canShowInterstitial()) return Promise.resolve(false);
      return this.openModal({
        kind: "interstitial simulado",
        title: "Anuncio de prueba",
        text: "Aqui aparecera un anuncio de pantalla completa en una transicion natural del juego.",
        seconds: 0
      }).then(() => {
        const data = this.getData();
        data.monetization.levelsCompletedSinceInterstitial = 0;
        this.recordAd("interstitialsShown");
        this.saveData();
        return true;
      });
    }

    showRewardedAd(rewardType) {
      if (!this.config.rewards[rewardType]) return Promise.resolve(false);
      return this.openModal({
        kind: "anuncio recompensado",
        title: "Anuncio de prueba",
        text: "La recompensa se otorgara automaticamente al terminar el temporizador.",
        seconds: 5
      }).then(() => {
        this.recordAd("rewardedWatched");
        this.grantReward(rewardType);
        return true;
      });
    }

    grantReward(rewardType) {
      const reward = this.config.rewards[rewardType];
      if (!reward) return;
      const data = this.getData();
      if (reward.coins) this.addCoins(reward.coins, "rewarded");
      if (reward.hints) {
        data.economy.hints += reward.hints;
        data.monetization.hintsEarned += reward.hints;
      }
      if (reward.unlocks) data.economy.unlockTokens += reward.unlocks;
      data.monetization.rewardsGranted += 1;
      this.saveData();
      if (this.onReward) this.onReward(rewardType, reward);
      if (this.onEconomyChanged) this.onEconomyChanged();
    }

    addCoins(amount, source) {
      const data = this.getData();
      data.economy.coins += amount;
      data.monetization.coinsEarned += Math.max(0, amount);
      if (source === "spent") data.monetization.coinsSpent += Math.abs(amount);
      this.saveData();
      if (this.onEconomyChanged) this.onEconomyChanged();
    }

    spendCoins(amount) {
      const data = this.getData();
      if (data.economy.coins < amount) return false;
      data.economy.coins -= amount;
      data.monetization.coinsSpent += amount;
      this.saveData();
      if (this.onEconomyChanged) this.onEconomyChanged();
      return true;
    }

    recordLevelCompleted() {
      const data = this.getData();
      data.monetization.levelsCompletedSinceInterstitial += 1;
      this.saveData();
    }

    recordAd(field) {
      const data = this.getData();
      data.monetization[field] += 1;
      data.monetization.adsViewed += 1;
      this.saveData();
    }

    openModal(options) {
      return new Promise((resolve) => {
        let remaining = options.seconds || 0;
        let interval = null;
        this.modal.kind.textContent = options.kind;
        this.modal.title.textContent = options.title;
        this.modal.text.textContent = options.text;
        this.modal.continueBtn.disabled = remaining > 0;
        this.modal.continueBtn.textContent = remaining > 0 ? "Continuar en " + remaining : "Continuar";
        this.modal.countdown.textContent = remaining > 0 ? remaining + "s" : "";
        this.modal.root.classList.remove("d-none");

        const finish = () => {
          if (interval) clearInterval(interval);
          this.modal.root.classList.add("d-none");
          this.modal.continueBtn.removeEventListener("click", finish);
          resolve(true);
        };

        this.modal.continueBtn.addEventListener("click", finish);
        if (remaining > 0) {
          interval = setInterval(() => {
            remaining -= 1;
            this.modal.countdown.textContent = remaining > 0 ? remaining + "s" : "Recompensa lista";
            this.modal.continueBtn.textContent = remaining > 0 ? "Continuar en " + remaining : "Continuar";
            if (remaining <= 0) {
              clearInterval(interval);
              this.modal.continueBtn.disabled = false;
              finish();
            }
          }, 1000);
        }
      });
    }
  }

  window.AdManager = AdManager;
  window.MonetizationConfig = DEFAULT_CONFIG;
}());
