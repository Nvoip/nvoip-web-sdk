(function () {
  const defaults = {
    title: "Validacao por telefone",
    subtitle: "Confirme o numero e depois informe o codigo recebido.",
    phoneLabel: "Telefone",
    codeLabel: "Codigo",
    startButtonText: "Enviar codigo",
    confirmButtonText: "Validar codigo",
    backButtonText: "Voltar",
    closeOnSuccess: true,
  };

  class Widget {
    constructor(options) {
      this.options = { ...defaults, ...options };
      this.sessionId = null;
      this.phone = "";
    }

    open() {
      if (typeof this.options.startVerification !== "function") {
        throw new Error("startVerification callback is required.");
      }

      if (typeof this.options.confirmVerification !== "function") {
        throw new Error("confirmVerification callback is required.");
      }

      this.overlay = document.createElement("div");
      this.overlay.className = "nvoip-auth-overlay";
      this.modal = document.createElement("div");
      this.modal.className = "nvoip-auth-modal";
      this.overlay.appendChild(this.modal);

      this.overlay.addEventListener("click", (event) => {
        if (event.target === this.overlay) {
          this.close();
        }
      });

      document.body.appendChild(this.overlay);
      this.renderPhoneStep();
    }

    close() {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    }

    renderPhoneStep(message = "", type = "") {
      this.modal.innerHTML = `
        <div class="nvoip-auth-header">
          <h2 class="nvoip-auth-title">${this.escape(this.options.title)}</h2>
          <p class="nvoip-auth-subtitle">${this.escape(this.options.subtitle)}</p>
        </div>
        <div class="nvoip-auth-body">
          <label class="nvoip-auth-label">${this.escape(this.options.phoneLabel)}</label>
          <input class="nvoip-auth-input" data-role="phone" placeholder="11999999999" value="${this.escape(
            this.phone
          )}" />
          <div class="nvoip-auth-message ${type}">${this.escape(message)}</div>
          <div class="nvoip-auth-actions">
            <button class="nvoip-auth-button primary" data-role="start">${this.escape(
              this.options.startButtonText
            )}</button>
          </div>
        </div>
      `;

      this.modal.querySelector('[data-role="start"]').addEventListener("click", async () => {
        const input = this.modal.querySelector('[data-role="phone"]');
        const phone = input.value.trim();

        if (!phone) {
          this.renderPhoneStep("Informe um telefone valido.", "error");
          return;
        }

        this.phone = phone;
        this.setMessage("Enviando codigo...", "success");

        try {
          const result = await this.options.startVerification({ phone });
          this.sessionId = result.sessionId || result.key || result.token2fa || null;

          if (!this.sessionId) {
            throw new Error("The startVerification callback must return sessionId, key or token2fa.");
          }

          this.renderCodeStep(result.message || "Codigo enviado com sucesso.");
        } catch (error) {
          this.renderPhoneStep(error.message || "Nao foi possivel iniciar a verificacao.", "error");
        }
      });
    }

    renderCodeStep(message = "") {
      this.modal.innerHTML = `
        <div class="nvoip-auth-header">
          <h2 class="nvoip-auth-title">${this.escape(this.options.title)}</h2>
          <p class="nvoip-auth-subtitle">Telefone ${this.escape(this.phone)}</p>
        </div>
        <div class="nvoip-auth-body">
          <label class="nvoip-auth-label">${this.escape(this.options.codeLabel)}</label>
          <input class="nvoip-auth-input" data-role="code" placeholder="123456" />
          <div class="nvoip-auth-message success">${this.escape(message)}</div>
          <div class="nvoip-auth-actions">
            <button class="nvoip-auth-button secondary" data-role="back">${this.escape(
              this.options.backButtonText
            )}</button>
            <button class="nvoip-auth-button primary" data-role="confirm">${this.escape(
              this.options.confirmButtonText
            )}</button>
          </div>
        </div>
      `;

      this.modal.querySelector('[data-role="back"]').addEventListener("click", () => {
        this.renderPhoneStep();
      });

      this.modal.querySelector('[data-role="confirm"]').addEventListener("click", async () => {
        const input = this.modal.querySelector('[data-role="code"]');
        const code = input.value.trim();

        if (!code) {
          this.setMessage("Informe o codigo recebido.", "error");
          return;
        }

        this.setMessage("Validando codigo...", "success");

        try {
          const result = await this.options.confirmVerification({
            sessionId: this.sessionId,
            code,
            phone: this.phone,
          });

          this.setMessage("Codigo validado com sucesso.", "success");
          if (typeof this.options.onSuccess === "function") {
            this.options.onSuccess({ phone: this.phone, code, sessionId: this.sessionId, result });
          }

          if (this.options.closeOnSuccess) {
            window.setTimeout(() => this.close(), 600);
          }
        } catch (error) {
          this.setMessage(error.message || "Nao foi possivel validar o codigo.", "error");
        }
      });
    }

    setMessage(message, type) {
      const el = this.modal.querySelector(".nvoip-auth-message");
      if (!el) {
        return;
      }

      el.textContent = message;
      el.className = `nvoip-auth-message ${type}`;
    }

    escape(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }
  }

  window.NvoipAuthWidget = {
    open(options) {
      const widget = new Widget(options);
      widget.open();
      return widget;
    },
    mount(trigger, options) {
      trigger.addEventListener("click", () => {
        window.NvoipAuthWidget.open(options);
      });
    },
  };
})();
