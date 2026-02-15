// app/(tabs)/index.tsx - Écran d'accueil Aura-X
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

interface UserData {
  id: string;
  email: string;
  credits: number;
  isAdmin: boolean;
}

export default function HomeScreen() {
  const colors = useColors();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentGenerations, setRecentGenerations] = useState([]);

  useEffect(() => {
    loadUserData();
    loadRecentGenerations();
  }, []);

  const loadUserData = async () => {
    try {
      // Simulé - remplacer par appel API réel
      setUser({
        id: '1',
        email: 'sekousanoh457@gmail.com',
        credits: 1000,
        isAdmin: true,
      });
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentGenerations = async () => {
    try {
      // Simulé - remplacer par appel API réel
      setRecentGenerations([
        { id: 1, type: 'image', prompt: 'Beautiful sunset', createdAt: new Date() },
        { id: 2, type: 'video', prompt: 'Dancing robot', createdAt: new Date() },
        { id: 3, type: 'voice', prompt: 'Hello world', createdAt: new Date() },
      ]);
    } catch (error) {
      console.error('Erreur chargement générations:', error);
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="bg-gradient-to-b from-primary to-primary/80 px-6 py-8 rounded-b-3xl">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-white text-sm opacity-80">Bienvenue</Text>
              <Text className="text-white text-2xl font-bold">{user?.email.split('@')[0]}</Text>
            </View>
            <Image
              source={{ uri: 'https://via.placeholder.com/50' }}
              className="w-12 h-12 rounded-full"
            />
          </View>

          {/* Crédits */}
          <View className="bg-white/20 rounded-2xl px-4 py-3 flex-row items-center justify-between">
            <View>
              <Text className="text-white/80 text-xs">Crédits disponibles</Text>
              <Text className="text-white text-2xl font-bold">{user?.credits}</Text>
            </View>
            <TouchableOpacity className="bg-white/30 px-4 py-2 rounded-lg">
              <Text className="text-white font-semibold">Acheter</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contenu principal */}
        <View className="px-6 py-8">
          {/* Génération rapide */}
          <Text className="text-foreground text-lg font-bold mb-4">Générer du contenu</Text>
          
          <View className="gap-3 mb-8">
            {/* Génération d'images */}
            <TouchableOpacity className="bg-surface rounded-2xl p-4 flex-row items-center justify-between border border-border">
              <View className="flex-1">
                <Text className="text-foreground font-semibold">🖼️ Images IA</Text>
                <Text className="text-muted text-sm">18 styles disponibles</Text>
              </View>
              <Text className="text-primary font-bold">→</Text>
            </TouchableOpacity>

            {/* Génération de vidéos */}
            <TouchableOpacity className="bg-surface rounded-2xl p-4 flex-row items-center justify-between border border-border">
              <View className="flex-1">
                <Text className="text-foreground font-semibold">🎬 Vidéos</Text>
                <Text className="text-muted text-sm">Jusqu'à 30 secondes</Text>
              </View>
              <Text className="text-primary font-bold">→</Text>
            </TouchableOpacity>

            {/* Génération de voix */}
            <TouchableOpacity className="bg-surface rounded-2xl p-4 flex-row items-center justify-between border border-border">
              <View className="flex-1">
                <Text className="text-foreground font-semibold">🎙️ Voix</Text>
                <Text className="text-muted text-sm">10000+ langues</Text>
              </View>
              <Text className="text-primary font-bold">→</Text>
            </TouchableOpacity>
          </View>

          {/* Générations récentes */}
          <Text className="text-foreground text-lg font-bold mb-4">Générations récentes</Text>
          
          <View className="gap-3">
            {recentGenerations.map((gen) => (
              <View key={gen.id} className="bg-surface rounded-xl p-3 border border-border">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold capitalize">{gen.type}</Text>
                    <Text className="text-muted text-sm">{gen.prompt}</Text>
                  </View>
                  <TouchableOpacity className="bg-primary/20 px-3 py-1 rounded-lg">
                    <Text className="text-primary text-xs font-semibold">Voir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Admin Panel */}
          {user?.isAdmin && (
            <View className="mt-8 pt-8 border-t border-border">
              <Text className="text-foreground text-lg font-bold mb-4">👨‍💼 Panneau Admin</Text>
              <TouchableOpacity className="bg-warning/20 rounded-xl p-4 border border-warning">
                <Text className="text-warning font-semibold">Gérer les utilisateurs</Text>
                <Text className="text-warning/80 text-sm mt-1">Voir tous les utilisateurs et gérer les crédits</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
