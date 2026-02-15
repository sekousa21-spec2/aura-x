// app/(tabs)/generate-image.tsx - Génération d'images
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

interface ImageGenerationData {
  prompt: string;
  style: string;
  format: string;
}

const IMAGE_STYLES = [
  'realistic', 'artistic', 'anime', 'oil_painting', 'watercolor',
  'digital_art', 'photorealistic', 'cinematic', 'fantasy', 'steampunk',
  'cyberpunk', 'minimalist', 'abstract', 'surreal', 'vintage', 'sketch',
  'cartoon', 'comic_book',
];

const IMAGE_FORMATS = [
  { name: 'square', label: '1:1' },
  { name: 'portrait', label: '3:4' },
  { name: 'landscape', label: '16:9' },
  { name: 'vertical', label: '9:16' },
  { name: 'horizontal', label: '21:9' },
  { name: 'heritage', label: '3:4' },
];

export default function GenerateImageScreen() {
  const colors = useColors();
  const [formData, setFormData] = useState<ImageGenerationData>({
    prompt: '',
    style: 'realistic',
    format: 'landscape',
  });
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [creditsUsed, setCreditsUsed] = useState(0);

  const handleGenerate = async () => {
    if (!formData.prompt.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une description');
      return;
    }

    setLoading(true);
    try {
      // Appel API réel
      const response = await fetch('http://localhost:3000/api/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN_HERE',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedImage(data.imageUrl);
        setCreditsUsed(data.creditsUsed);
      } else {
        Alert.alert('Erreur', data.error || 'Erreur lors de la génération');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de générer l\'image');
      console.error('Erreur génération:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="bg-gradient-to-b from-primary to-primary/80 px-6 py-8 rounded-b-3xl">
          <Text className="text-white text-3xl font-bold">🖼️ Générer une Image</Text>
          <Text className="text-white/80 text-base mt-2">18 styles disponibles</Text>
        </View>

        {/* Contenu */}
        <View className="px-6 py-8">
          {/* Prompt */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold mb-2">Description (Prompt)</Text>
            <TextInput
              placeholder="Ex: Un coucher de soleil sur l'océan..."
              placeholderTextColor={colors.muted}
              value={formData.prompt}
              onChangeText={(text) => setFormData({ ...formData, prompt: text })}
              multiline
              numberOfLines={4}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              editable={!loading}
            />
            <Text className="text-muted text-xs mt-1">{formData.prompt.length}/1000 caractères</Text>
          </View>

          {/* Style */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold mb-3">Style</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
              {IMAGE_STYLES.map((style) => (
                <TouchableOpacity
                  key={style}
                  onPress={() => setFormData({ ...formData, style })}
                  className={`px-4 py-2 rounded-full ${
                    formData.style === style
                      ? 'bg-primary'
                      : 'bg-surface border border-border'
                  }`}
                >
                  <Text className={formData.style === style ? 'text-white' : 'text-foreground'}>
                    {style.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Format */}
          <View className="mb-8">
            <Text className="text-foreground font-semibold mb-3">Format</Text>
            <View className="flex-row flex-wrap gap-2">
              {IMAGE_FORMATS.map((format) => (
                <TouchableOpacity
                  key={format.name}
                  onPress={() => setFormData({ ...formData, format: format.name })}
                  className={`flex-1 min-w-[30%] px-3 py-3 rounded-lg ${
                    formData.format === format.name
                      ? 'bg-primary'
                      : 'bg-surface border border-border'
                  }`}
                >
                  <Text className={formData.format === format.name ? 'text-white text-center' : 'text-foreground text-center'}>
                    {format.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Image générée */}
          {generatedImage && (
            <View className="mb-8">
              <Text className="text-foreground font-semibold mb-3">Image générée</Text>
              <Image
                source={{ uri: generatedImage }}
                className="w-full h-64 rounded-lg bg-surface"
              />
              <View className="flex-row justify-between mt-3">
                <Text className="text-muted">Crédits utilisés: {creditsUsed}</Text>
                <TouchableOpacity className="bg-primary/20 px-3 py-1 rounded-lg">
                  <Text className="text-primary text-sm font-semibold">Télécharger</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bouton générer */}
          <TouchableOpacity
            onPress={handleGenerate}
            disabled={loading || !formData.prompt.trim()}
            className={`rounded-lg py-4 flex-row items-center justify-center ${
              loading || !formData.prompt.trim() ? 'bg-primary/50' : 'bg-primary'
            }`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-bold">Générer l'image</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
