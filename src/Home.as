package  
{
	import flash.geom.Point;
	import net.flashpunk.Entity;
	import net.flashpunk.graphics.Image;
	import net.flashpunk.FP;
	/**
	 * ...
	 * @author vadim
	 */
	public class Home extends Entity 
	{
		[Embed(source = '../assets/graphics/home.png')] public const HOME_GRAPHIC:Class;
		public function Home(position:Point) 
		{
			x = position.x;
			y = position.y;
			graphic = new Image(HOME_GRAPHIC);
			setHitbox(96, 32, -FP.screen.x, -FP.screen.y-32);
			type = "home";
		}
		
		override public function update():void 
		{
			if (collide("player", x, y))
			{
				Assets.UpdateHealth(5);
			}
			
			super.update();
		}
	}

}