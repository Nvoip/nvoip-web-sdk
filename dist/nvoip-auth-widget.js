(function () {
  const defaults = {
    flow: "otp",
    channels: ["sms"],
    eyebrow: "VALIDAÇÃO",
    title: "Escolha um método de verificação",
    subtitle: "A Nvoip enviará um código para confirmar o acesso.",
    accountLabel: "Conta Nvoip",
    accountActionText: "Alterar telefone",
    helpText: "",
    helpHref: "",
    phone: "",
    maskedPhone: "",
    allowPhoneEdit: true,
    phoneLabel: "Telefone",
    phonePlaceholder: "11999999999",
    codeLabel: "Código de verificação",
    startButtonText: "Continuar",
    confirmButtonText: "Validar código",
    resendButtonText: "Enviar novamente",
    backButtonText: "Voltar",
    closeOnSuccess: true,
  };

  const channelPresets = {
    sms: {
      id: "sms",
      label: "SMS",
      description: "Vamos enviar um código para o telefone {maskedPhone}.",
    },
    whatsapp: {
      id: "whatsapp",
      label: "WhatsApp",
      description: "Vamos enviar um código pelo WhatsApp para o telefone {maskedPhone}.",
    },
    voice: {
      id: "voice",
      label: "Ligação",
      description: "Vamos ligar para o telefone {maskedPhone} e informar o código.",
    },
  };

  channelPresets.call = channelPresets.voice;
  channelPresets.phone = channelPresets.voice;

  class Widget {
    constructor(options) {
      this.options = { ...defaults, ...options };
      this.flow = this.normalizeFlow(this.options.flow);
      this.methods = this.normalizeChannels(this.options.methods || this.options.channels);
      this.sessionId = null;
      this.phone = this.options.phone || "";
      this.selectedMethod = null;
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
      this.modal.setAttribute("role", "dialog");
      this.modal.setAttribute("aria-modal", "true");
      this.modal.setAttribute("aria-label", this.options.title);
      this.overlay.appendChild(this.modal);

      this.overlay.addEventListener("click", (event) => {
        if (event.target === this.overlay) {
          this.close();
        }
      });

      document.body.appendChild(this.overlay);
      this.renderMethodStep();
    }

    close() {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    }

    renderMethodStep(message = "", type = "") {
      const phoneField = this.renderPhoneField();
      const methods = this.methods
        .map((method) => {
          const description = this.formatDescription(method);
          return `
            <button class="nvoip-auth-method" type="button" data-channel="${this.escape(method.id)}">
              <span class="nvoip-auth-method-icon">${this.renderMethodIcon(method)}</span>
              <span class="nvoip-auth-method-copy">
                <strong>${this.escape(method.label)}</strong>
                <span data-role="method-description" data-channel="${this.escape(method.id)}">${this.escape(
                  description
                )}</span>
              </span>
              <span class="nvoip-auth-chevron" aria-hidden="true">&rsaquo;</span>
            </button>
          `;
        })
        .join("");

      this.modal.innerHTML = `
        <button class="nvoip-auth-close" type="button" data-role="close" aria-label="Fechar">×</button>
        <div class="nvoip-auth-shell">
          <aside class="nvoip-auth-side">
            <p class="nvoip-auth-eyebrow">${this.escape(this.options.eyebrow)}</p>
            <h2 class="nvoip-auth-title">${this.escape(this.options.title)}</h2>
            <p class="nvoip-auth-subtitle">${this.escape(this.options.subtitle)}</p>
            ${phoneField}
            ${this.renderHelpLink()}
          </aside>
          <section class="nvoip-auth-card">
            <div class="nvoip-auth-card-head">
              <span class="nvoip-auth-flow">${this.escape(this.flow.toUpperCase())}</span>
              <h3>Como você quer receber o código?</h3>
            </div>
            <div class="nvoip-auth-method-list">
              ${methods || '<div class="nvoip-auth-empty">Nenhum método habilitado.</div>'}
            </div>
            <div class="nvoip-auth-message ${this.escape(type)}" role="status" aria-live="polite">${this.escape(
        message
      )}</div>
          </section>
        </div>
      `;

      this.bindSharedEvents();

      const phoneInput = this.modal.querySelector('[data-role="phone"]');
      if (phoneInput) {
        phoneInput.addEventListener("input", () => {
          this.phone = phoneInput.value.trim();
          this.refreshMethodDescriptions();
        });
      }

      this.modal.querySelectorAll(".nvoip-auth-method[data-channel]").forEach((button) => {
        button.addEventListener("click", () => {
          const channel = button.getAttribute("data-channel");
          const method = this.methods.find((item) => item.id === channel);
          if (method) {
            this.startSelectedMethod(method);
          }
        });
      });
    }

    renderCodeStep(message = "") {
      const method = this.selectedMethod || this.methods[0];
      this.modal.innerHTML = `
        <button class="nvoip-auth-close" type="button" data-role="close" aria-label="Fechar">×</button>
        <div class="nvoip-auth-shell compact">
          <aside class="nvoip-auth-side">
            <p class="nvoip-auth-eyebrow">${this.escape(this.flow.toUpperCase())}</p>
            <h2 class="nvoip-auth-title">Digite o código recebido</h2>
            <p class="nvoip-auth-subtitle">${this.escape(this.formatCodeSubtitle(method))}</p>
            ${this.renderAccountPill()}
            ${this.renderHelpLink()}
          </aside>
          <section class="nvoip-auth-card">
            <div class="nvoip-auth-selected-method">
              <span class="nvoip-auth-method-icon">${this.renderMethodIcon(method)}</span>
              <span>
                <strong>${this.escape(method.label)}</strong>
                <small>${this.escape(this.formatDescription(method))}</small>
              </span>
            </div>
            <label class="nvoip-auth-label" for="nvoip-auth-code">${this.escape(this.options.codeLabel)}</label>
            <input
              class="nvoip-auth-input code"
              id="nvoip-auth-code"
              data-role="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="123456"
            />
            <div class="nvoip-auth-message success" role="status" aria-live="polite">${this.escape(message)}</div>
            <div class="nvoip-auth-actions">
              <button class="nvoip-auth-button secondary" type="button" data-role="back">${this.escape(
                this.options.backButtonText
              )}</button>
              <button class="nvoip-auth-button primary" type="button" data-role="confirm">${this.escape(
                this.options.confirmButtonText
              )}</button>
            </div>
            <button class="nvoip-auth-link-button" type="button" data-role="resend">${this.escape(
              this.options.resendButtonText
            )}</button>
          </section>
        </div>
      `;

      this.bindSharedEvents();

      this.modal.querySelector('[data-role="back"]').addEventListener("click", () => {
        this.renderMethodStep();
      });

      this.modal.querySelector('[data-role="resend"]').addEventListener("click", () => {
        this.startSelectedMethod(method);
      });

      this.modal.querySelector('[data-role="confirm"]').addEventListener("click", async () => {
        const input = this.modal.querySelector('[data-role="code"]');
        const code = input.value.trim();

        if (!code) {
          this.setMessage("Informe o código recebido.", "error");
          return;
        }

        this.setConfirmLoading(true);
        this.setMessage("Validando código...", "success");

        try {
          const result = await this.options.confirmVerification({
            sessionId: this.sessionId,
            code,
            phone: this.phone,
            channel: method.id,
            method,
            flow: this.flow,
          });

          this.setMessage("Código validado com sucesso.", "success");
          if (typeof this.options.onSuccess === "function") {
            this.options.onSuccess({
              phone: this.phone,
              code,
              sessionId: this.sessionId,
              channel: method.id,
              method,
              flow: this.flow,
              result,
            });
          }

          if (this.options.closeOnSuccess) {
            window.setTimeout(() => this.close(), 700);
          } else {
            this.setConfirmLoading(false);
          }
        } catch (error) {
          this.setConfirmLoading(false);
          this.setMessage(error.message || "Não foi possível validar o código.", "error");
        }
      });

      const input = this.modal.querySelector('[data-role="code"]');
      if (input) {
        input.focus();
      }
    }

    async startSelectedMethod(method) {
      const phone = this.readPhone();
      if (!phone) {
        this.renderMethodStep("Informe um telefone válido antes de escolher o método.", "error");
        return;
      }

      this.phone = phone;
      this.selectedMethod = method;
      this.setMethodLoading(method.id, true);
      this.setMessage("Enviando código...", "success");

      try {
        const result = await this.options.startVerification({
          phone,
          channel: method.id,
          method,
          flow: this.flow,
        });
        this.sessionId = result.sessionId || result.key || result.token2fa || null;

        if (!this.sessionId) {
          throw new Error("The startVerification callback must return sessionId, key or token2fa.");
        }

        this.renderCodeStep(result.message || "Código enviado com sucesso.");
      } catch (error) {
        this.renderMethodStep(error.message || "Não foi possível iniciar a verificação.", "error");
      }
    }

    bindSharedEvents() {
      const close = this.modal.querySelector('[data-role="close"]');
      if (close) {
        close.addEventListener("click", () => this.close());
      }
    }

    renderPhoneField() {
      if (!this.options.allowPhoneEdit) {
        return this.renderAccountPill();
      }

      return `
        <div class="nvoip-auth-phone-box">
          <label class="nvoip-auth-label" for="nvoip-auth-phone">${this.escape(this.options.phoneLabel)}</label>
          <input
            class="nvoip-auth-input"
            id="nvoip-auth-phone"
            data-role="phone"
            inputmode="tel"
            autocomplete="tel"
            placeholder="${this.escape(this.options.phonePlaceholder)}"
            value="${this.escape(this.phone)}"
          />
        </div>
      `;
    }

    renderAccountPill() {
      const label = this.options.accountLabel || "Conta Nvoip";
      const phone = this.options.maskedPhone || this.maskPhone(this.phone) || "telefone informado";
      return `
        <div class="nvoip-auth-account">
          <span class="nvoip-auth-account-icon" aria-hidden="true"></span>
          <span>
            <strong>${this.escape(label)}</strong>
            <small>${this.escape(phone)}</small>
          </span>
        </div>
      `;
    }

    renderHelpLink() {
      if (!this.options.helpText) {
        return "";
      }

      if (this.options.helpHref) {
        return `<a class="nvoip-auth-help" href="${this.escape(this.options.helpHref)}" target="_blank" rel="noreferrer">${this.escape(
          this.options.helpText
        )}</a>`;
      }

      return `<span class="nvoip-auth-help">${this.escape(this.options.helpText)}</span>`;
    }

    setMessage(message, type) {
      const el = this.modal.querySelector(".nvoip-auth-message");
      if (!el) {
        return;
      }

      el.textContent = message;
      el.className = `nvoip-auth-message ${type || ""}`;
    }

    setMethodLoading(channel, isLoading) {
      this.modal.querySelectorAll(".nvoip-auth-method").forEach((button) => {
        button.disabled = isLoading;
        button.classList.toggle("loading", isLoading && button.getAttribute("data-channel") === channel);
      });
    }

    setConfirmLoading(isLoading) {
      const button = this.modal.querySelector('[data-role="confirm"]');
      if (button) {
        button.disabled = isLoading;
      }
    }

    refreshMethodDescriptions() {
      this.modal.querySelectorAll('[data-role="method-description"]').forEach((el) => {
        const channel = el.getAttribute("data-channel");
        const method = this.methods.find((item) => item.id === channel);
        if (method) {
          el.textContent = this.formatDescription(method);
        }
      });
    }

    readPhone() {
      const input = this.modal.querySelector('[data-role="phone"]');
      if (input) {
        return input.value.trim();
      }

      return (this.phone || this.options.phone || "").trim();
    }

    formatDescription(method) {
      const phone = this.readPhone() || this.phone || this.options.phone || "";
      const maskedPhone = this.options.maskedPhone || this.maskPhone(phone) || "informado";
      return (method.description || "")
        .replaceAll("{phone}", phone)
        .replaceAll("{maskedPhone}", maskedPhone)
        .replaceAll("{last4}", this.lastFour(phone) || "----");
    }

    formatCodeSubtitle(method) {
      if (method.id === "voice") {
        return "Aguarde a ligação e informe o código recebido.";
      }

      return "Informe abaixo o código enviado para continuar.";
    }

    normalizeChannels(channels) {
      const source = channels === undefined ? defaults.channels : channels;
      const list = Array.isArray(source) ? source : String(source).split(",");

      return list
        .map((item) => {
          const rawId = typeof item === "string" ? item.trim().toLowerCase() : String(item.id || "").toLowerCase();
          const id = this.normalizeChannelId(rawId);
          const preset = channelPresets[id] || {
            id,
            label: id || "Método",
            icon: (id || "M").slice(0, 3).toUpperCase(),
            description: "Vamos enviar um código para o telefone {maskedPhone}.",
          };

          if (!id) {
            return null;
          }

          const method = typeof item === "string" ? { ...preset } : { ...preset, ...item, id };
          if (method.enabled === false) {
            return null;
          }

          return method;
        })
        .filter(Boolean);
    }

    normalizeFlow(flow) {
      return String(flow || "otp").toLowerCase() === "2fa" ? "2fa" : "otp";
    }

    normalizeChannelId(channel) {
      const value = String(channel || "").toLowerCase();
      if (value === "call" || value === "phone") {
        return "voice";
      }

      return value;
    }

    renderMethodIcon(method) {
      if (method.id === "sms") {
        return `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17H9l-4.5 3v-3H5A1.5 1.5 0 0 1 3.5 15.5V7A1.5 1.5 0 0 1 5 5.5Z" />
            <path d="M7.5 9h9M7.5 12h6" />
          </svg>
        `;
      }

      if (method.id === "whatsapp") {
        return `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5.4 18.7 6.2 16A8 8 0 1 1 9 18.5l-3.6.2Z" />
            <path d="M9.2 8.6c.2-.5.4-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.3.1.5-.1.7l-.4.5c.6 1 1.4 1.8 2.6 2.3l.5-.6c.2-.2.4-.3.7-.2l1.7.8c.3.1.4.3.4.6v.4c0 .5-.3.9-.8 1.1-.6.3-1.4.3-2.5-.2-2.5-1-4.2-2.7-5.2-5.1-.4-1-.3-1.6.1-1.8Z" />
          </svg>
        `;
      }

      if (method.id === "voice") {
        return `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.2 4.7 10 8.5 8.5 10c.9 1.9 2.3 3.3 4.2 4.2l1.5-1.5 3.8 1.8-.4 3.2c-.1.7-.7 1.3-1.4 1.3C10 19 5 14 5 7.8c0-.7.5-1.3 1.3-1.4l1.9-.7Z" />
          </svg>
        `;
      }

      return this.escape(method.icon || method.label.slice(0, 3));
    }

    maskPhone(phone) {
      const last4 = this.lastFour(phone);
      return last4 ? `terminado em ${last4}` : "";
    }

    lastFour(phone) {
      const digits = String(phone || "").replace(/\D/g, "");
      return digits.length >= 4 ? digits.slice(-4) : "";
    }

    escape(value) {
      return String(value === undefined || value === null ? "" : value)
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
