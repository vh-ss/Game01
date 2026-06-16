package  
{
	import flash.geom.Point;
	import net.flashpunk.Entity;
	import net.flashpunk.graphics.Image;
	import net.flashpunk.utils.Input;
	import net.flashpunk.utils.Key;
	import net.flashpunk.FP;
	/**
	 * ...
	 * @author vadim
	 */
	public class Player extends Entity 
	{
		[Embed(source = '../assets/graphics/player.png')] private const PLAYER_GRAPHIC:Class;
		public var image;
		
		
		public function Player(position:Point) 
		{
			x = position.x;
			y = position.y;
			image = new Image(PLAYER_GRAPHIC);
			graphic = image;//new Image(PLAYER_GRAPHIC);
			
			//setHitbox((image as Image).width-16, (image as Image).height-16, -FP.screen.x-8, -FP.screen.y-8);//37, 49, 0, 0);//
			setHitbox((image as Image).width, (image as Image).height, -FP.screen.x, -FP.screen.y);//37, 49, 0, 0);//
			type = "player";
		}
		
		override public function update():void 
		{
			move();
			
			super.update();
		}
		
		private function move():void 
		{
			if (Input.check(Key.RIGHT))	
			{
				x += 100 * FP.elapsed; 
				while (collide("level", x - FP.screen.x, y - FP.screen.y))	x -= 1;
				if (x + image.width > Assets.GAMEWIDTH) x = Assets.GAMEWIDTH-image.width; 
			}
				
			if (Input.check(Key.LEFT))  
			{
				x -= 100 * FP.elapsed;
				while (collide("level", x - FP.screen.x, y - FP.screen.y))	x += 1;
				if (x < 0) x = 0;
			}
			
			if (Input.check(Key.UP)) 
			{
				y -= 100 * FP.elapsed;
				while (collide("level", x - FP.screen.x, y - FP.screen.y))	y += 1;
				if (y < 0) y = 0;
			}
			if (Input.check(Key.DOWN))	
			{
				y += 100 * FP.elapsed;
				while (collide("level", x - FP.screen.x, y - FP.screen.y))	y -= 1;
				if (y + image.height > Assets.GAMEHEIGHT) y = Assets.GAMEHEIGHT - image.height;
			}
			
			FP.camera.x = x - FP.screen.width/2;
			FP.camera.y = y - FP.screen.height / 2;
			
			
		}
		
		
	}
}