import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { APP_ICONS } from '../../../../core/constants/icons';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SafeHtmlPipe],
    templateUrl: './login.component.html',
    styles: [`
        :host { display: block; height: 100vh; }
    `]
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    
    icons = APP_ICONS;
    loading = signal(false);
    showPassword = signal(false);

    loginForm: FormGroup = this.fb.group({
        username: ['', [Validators.required, Validators.minLength(3)]],
        password: ['', [Validators.required, Validators.minLength(3)]]
    });

    async onLogin() {
        if (this.loginForm.invalid) {
            this.loginForm.markAllAsTouched();
            return;
        }

        this.loading.set(true);
        const { username, password } = this.loginForm.value;
        
        try {
            await this.authService.login(username, password);
        } finally {
            this.loading.set(false);
        }
    }

    togglePassword() {
        this.showPassword.update(v => !v);
    }
}


