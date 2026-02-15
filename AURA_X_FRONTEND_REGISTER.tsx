// app/auth/register.tsx - Écran d'inscription
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterScreen() {
  const colors = useColors();
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<RegisterFormData>>({});

  const validateForm = () => {
    const newErrors: Partial<RegisterFormData> = {};

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Appel API réel
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          userAgent: 'Mobile App',
          ipAddress: '127.0.0.1',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Succès', 'Inscription réussie! Vérifiez votre email pour le code OTP.');
        // Rediriger vers écran de vérification OTP
      } else {
        Alert.alert('Erreur', data.error || 'Erreur lors de l\'inscription');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de se connecter au serveur');
      console.error('Erreur inscription:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="bg-primary px-6 py-12 rounded-b-3xl">
          <Text className="text-white text-4xl font-bold">Créer un compte</Text>
          <Text className="text-white/80 text-base mt-2">Rejoignez Aura-X et commencez à générer</Text>
        </View>

        {/* Formulaire */}
        <View className="px-6 py-8 flex-1">
          {/* Email */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold mb-2">Email</Text>
            <TextInput
              placeholder="votre-email@gmail.com"
              placeholderTextColor={colors.muted}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              editable={!loading}
            />
            {errors.email && <Text className="text-error text-sm mt-1">{errors.email}</Text>}
          </View>

          {/* Mot de passe */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold mb-2">Mot de passe</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-lg px-4 py-3">
              <TextInput
                placeholder="Au moins 8 caractères"
                placeholderTextColor={colors.muted}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry={!showPassword}
                className="flex-1 text-foreground"
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text className="text-primary font-bold">{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password && <Text className="text-error text-sm mt-1">{errors.password}</Text>}
          </View>

          {/* Confirmation mot de passe */}
          <View className="mb-8">
            <Text className="text-foreground font-semibold mb-2">Confirmer le mot de passe</Text>
            <TextInput
              placeholder="Répétez votre mot de passe"
              placeholderTextColor={colors.muted}
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              secureTextEntry={!showPassword}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              editable={!loading}
            />
            {errors.confirmPassword && <Text className="text-error text-sm mt-1">{errors.confirmPassword}</Text>}
          </View>

          {/* Bouton d'inscription */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            className="bg-primary rounded-lg py-4 flex-row items-center justify-center mb-4"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-bold">S'inscrire</Text>
            )}
          </TouchableOpacity>

          {/* Conditions d'utilisation */}
          <Text className="text-muted text-xs text-center mb-8">
            En vous inscrivant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
          </Text>

          {/* Lien connexion */}
          <View className="flex-row justify-center gap-2">
            <Text className="text-muted">Vous avez déjà un compte?</Text>
            <TouchableOpacity>
              <Text className="text-primary font-bold">Se connecter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
